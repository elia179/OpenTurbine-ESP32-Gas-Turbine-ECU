#!/usr/bin/env python3
"""Regenerate editable, terminal-labelled learning diagrams; no raster artwork."""
from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'site/assets/images/guided-builds'
POWER, SIGNAL, GROUND = '#ff9276', '#74dcb7', '#b6c4d2'


class Drawing:
    def __init__(self, title, note):
        self.items = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(note)}</desc>',
                      '<style>text{font-family:Arial,sans-serif;fill:#eef4f8;font-size:19px}.small{font-size:16px;fill:#bac9d6}.heading{font-size:26px;font-weight:bold}.net{fill:none;stroke-width:3;stroke-linejoin:round}.heavy{stroke-width:5}</style>',
                      '<rect width="1000" height="600" rx="18" fill="#101922"/>']
        self.text(30, 42, title, 'heading')
        self.text(30, 76, note, 'small')

    def text(self, x, y, value, cls='', anchor='start'):
        self.items.append(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{escape(value)}</text>')

    def box(self, x, y, w, h, name):
        self.items.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#1c2b38" stroke="#566a7c" stroke-width="2"/>')
        self.text(x+w/2, y+32, name, '', 'middle')

    def wire(self, points, color=SIGNAL, heavy=False):
        self.items.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" class="net{" heavy" if heavy else ""}" stroke="{color}"/>')

    def dot(self, x, y, color=SIGNAL):
        self.items.append(f'<circle cx="{x}" cy="{y}" r="5" fill="{color}"/>')

    def resistor(self, x, y, label):
        self.items.append(f'<rect x="{x-9}" y="{y}" width="18" height="42" fill="#101922" stroke="#b6c4d2" stroke-width="2"/>')
        self.text(x+18, y+28, label, 'small')

    def save(self, name):
        self.text(30, 558, 'Signal / command', 'small')
        self.wire([(190,552),(242,552)])
        self.text(270,558,'Supply / load power','small')
        self.wire([(447,552),(499,552)], POWER)
        self.text(528,558,'Ground / return','small')
        self.wire([(695,552),(747,552)],GROUND)
        self.text(30,584,'Connections are also listed in the guide. Confirm the exact module pinout before wiring.','small')
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / f'{name}.svg').write_text('\n'.join(self.items)+'</svg>\n', encoding='utf-8')


def linked(name, title, note, device, rows):
    d=Drawing(title,note)
    d.box(35,115,280,350,'ESP32 ECU')
    d.box(685,115,280,350,device)
    for i,(left,right,color) in enumerate(rows):
        y=190+i*52
        d.text(295,y-9,left,'','end'); d.text(705,y-9,right)
        d.wire([(315,y),(685,y)],color)
    d.save(name)


def main():
    d=Drawing('ECU and load power are separate paths','Functional power diagram: use USB alone for the first bench session; follow board supply limits.')
    d.box(30,140,260,260,'Installation supply');d.box(370,130,260,110,'Fuse + regulator');d.box(720,130,250,110,'ECU power input')
    d.text(50,210,'Positive');d.wire([(290,220),(330,220),(330,185),(370,185)],POWER)
    d.wire([(630,185),(720,185)],POWER);d.text(640,164,'Board-rated','small')
    d.box(370,320,260,110,'Fuse + physical stop');d.box(720,320,250,110,'Driver / load')
    d.wire([(330,220),(330,375),(370,375)],POWER,True);d.dot(330,220,POWER);d.wire([(630,375),(720,375)],POWER,True)
    d.text(50,365,'Negative / return');d.wire([(160,400),(160,480),(845,480),(845,430)],GROUND,True)
    d.wire([(675,480),(675,255),(845,255),(845,240)],GROUND);d.dot(675,480,GROUND)
    d.text(370,507,'Keep load return current out of the ECU sensor-ground path.','small');d.save('power')
    linked('thermocouple','Turbine temperature through MAX31855','Use a 3.3 V-compatible breakout. Connect probe + / − to its thermocouple terminals.','MAX31855 module',[
        ('3.3 V','VCC',POWER),('GND','GND',GROUND),('SPI clock GPIO','CLK / SCK',SIGNAL),('SPI input GPIO','DO / MISO',SIGNAL),('Chip-select GPIO','CS',SIGNAL)])
    p=OUT/'thermocouple.svg'; s=p.read_text(); s=s.replace('</svg>','<text x="750" y="447" class="small">TC +</text><text x="850" y="447" class="small">TC −</text><path d="M 775,455 V 485 M 875,455 V 485" class="net" stroke="#74dcb7"/><rect x="690" y="485" width="270" height="45" rx="8" fill="#1c2b38" stroke="#566a7c"/><text x="825" y="514" text-anchor="middle">K-type probe</text></svg>'); p.write_text(s)
    d=Drawing('Servo / ESC command','Separate device-rated supply powers the servo. GPIO sends only the control pulse.')
    d.box(35,120,280,330,'ESP32 ECU');d.box(685,120,280,330,'Servo / ESC input')
    d.text(295,195,'Signal GPIO','','end');d.text(705,195,'Signal');d.wire([(315,205),(685,205)])
    d.text(295,258,'GND reference','','end');d.text(705,258,'Signal ground');d.wire([(315,268),(685,268)],GROUND)
    d.box(350,335,250,150,'External supply');d.text(370,395,'Device-rated +');d.text(370,458,'Supply −')
    d.text(705,395,'Device power +');d.wire([(600,405),(685,405)],POWER)
    d.wire([(600,468),(650,468),(650,268)],GROUND);d.dot(650,268,GROUND)
    d.text(30,519,'For an ESC, motor power and any BEC connection follow that controller’s documentation.','small');d.save('servo')
    d=Drawing('Dry-contact input with internal pull-up','Enable Pull-up and active-low in Hardware. Closed contact connects GPIO to GND.')
    d.box(35,115,280,350,'ESP32 ECU'); d.box(685,115,280,350,'Dry contact')
    d.text(130,190,'3.3 V','','middle'); d.wire([(130,200),(130,225)],POWER)
    d.resistor(130,225,'Internal'); d.wire([(130,267),(130,305),(315,305)])
    d.text(55,355,'Pull-up enabled','small'); d.text(295,294,'GPIO','','end')
    d.text(705,294,'Contact A'); d.wire([(315,305),(685,305)])
    d.dot(130,305); d.text(295,389,'GND','','end'); d.text(705,389,'Contact B')
    d.wire([(315,400),(685,400)],GROUND)
    d.text(350,480,'Pins without internal bias need an external pull-up.','small'); d.save('switch')
    d=Drawing('DS18B20 temperature input','Use externally powered three-wire mode with an external 4.7 kΩ data pull-up.')
    d.box(35,115,280,350,'ESP32 ECU'); d.box(685,115,280,350,'DS18B20')
    for y,left,right,color in [(190,'3.3 V','VDD',POWER),(310,'OneWire GPIO','DQ / data',SIGNAL),(410,'GND','GND',GROUND)]:
        d.text(295,y-10,left,'','end'); d.text(705,y-10,right); d.wire([(315,y),(685,y)],color)
    d.wire([(490,190),(490,228)],POWER); d.resistor(490,228,'4.7 kΩ')
    d.wire([(490,270),(490,310)]); d.dot(490,190,POWER); d.dot(490,310)
    d.save('temperature')

    d=Drawing('Torque from shaft twist','Two matching conditioned pulse trains from separate points on one shaft; no shared bus.')
    d.box(35,135,280,140,'Reference pickup'); d.box(35,330,280,140,'Phase pickup')
    d.box(685,135,280,335,'ESP32 Torque input')
    d.text(55,213,'3.3 V square wave','small'); d.text(55,408,'3.3 V square wave','small')
    d.wire([(315,235),(685,235)]); d.text(705,225,'Reference GPIO')
    d.wire([(315,430),(685,430)]); d.text(705,420,'Phase GPIO')
    d.text(355,285,'Same torque-carrying shaft','small')
    d.text(355,320,'Matching pulses / revolution','small')
    d.text(355,355,'Running zero + known torque','small')
    d.text(35,510,'Conditioner supply and ground follow the exact sensor interface. Never feed raw VR into GPIO.','small')
    d.save('phase-torque')

    d=Drawing('Thrust through an I²C bridge amplifier','Activate the shared I²C bus, detect NAU7802, then assign and calibrate Thrust.')
    d.box(25,135,235,330,'ESP32 ECU'); d.box(375,135,250,330,'NAU7802 module'); d.box(760,135,215,330,'Load cell')
    for y,left,right,color in [(215,'3.3 V','VCC',POWER),(270,'GND','GND',GROUND),(325,'SDA GPIO','SDA',SIGNAL),(380,'SCL GPIO','SCL',SIGNAL)]:
        d.text(242,y-10,left,'','end'); d.text(390,y-10,right)
        d.wire([(260,y),(375,y)],color)
    for y,label,color in [(215,'E+',POWER),(270,'E−',GROUND),(325,'A+',SIGNAL),(380,'A−',SIGNAL)]:
        d.text(610,y-10,label,'','end'); d.text(775,y-10,label)
        d.wire([(625,y),(760,y)],color)
    d.text(30,502,'SDA/SCL need pull-ups to 3.3 V; check whether the breakout already includes them.','small')
    d.save('thrust-loadcell')

    d=Drawing('Hall pulse input','Bench example: DRV5033 at 3.3 V, 10 kΩ external pull-up, 100 nF supply bypass.')
    d.box(35,120,280,330,'ESP32 ECU'); d.box(685,120,280,330,'Hall sensor')
    for y,a,b,c in [(190,'3.3 V','VCC',POWER),(305,'Pulse GPIO','OUT',SIGNAL),(400,'GND','GND',GROUND)]:
        d.text(295,y-10,a,'','end'); d.text(705,y-10,b); d.wire([(315,y),(685,y)],c)
    d.wire([(460,190),(460,235)],POWER); d.resistor(460,235,'10 kΩ'); d.wire([(460,277),(460,305)])
    d.dot(460,190,POWER); d.dot(460,305)
    d.text(335,480,'Fit 100 nF between sensor VCC and GND near the sensor.','small')
    d.save('rpm')

    d=Drawing('Potentiometer throttle input','Bench example: 10 kΩ linear potentiometer between 3.3 V and GND.')
    d.box(35,120,280,330,'ESP32 ECU')
    d.text(295,180,'3.3 V','','end'); d.wire([(315,190),(660,190),(660,248)],POWER)
    d.items.append('<rect x="645" y="248" width="30" height="100" fill="#1c2b38" stroke="#b6c4d2" stroke-width="2"/>')
    d.text(705,275,'10 kΩ linear'); d.text(705,305,'potentiometer')
    d.text(295,288,'ADC GPIO','','end'); d.wire([(315,298),(645,298)])
    d.text(420,280,'Wiper','small'); d.items.append('<path d="M 632,290 L 645,298 L 632,306" fill="none" stroke="#74dcb7" stroke-width="2"/>')
    d.text(295,392,'GND','','end'); d.wire([(315,402),(660,402),(660,348)],GROUND)
    d.text(335,480,'Identify the wiper with a meter; do not rely on the physical pin order.','small'); d.save('throttle')

    d=Drawing('PWM driver and load','Nonisolated low-side driver module: logic input must accept 3.3 V.')
    d.box(30,190,245,265,'ESP32 ECU'); d.box(455,190,260,265,'Rated power driver'); d.box(790,190,180,265,'DC load')
    d.text(255,275,'PWM GPIO','','end');d.text(475,275,'IN');d.wire([(275,285),(455,285)])
    d.text(255,385,'GND','','end');d.text(475,385,'GND');d.wire([(275,395),(455,395)],GROUND)
    d.text(30,120,'Load supply + → fuse → independent stop → load +');d.wire([(800,130),(910,130),(910,190)],POWER,True)
    d.text(735,325,'LOAD −','small'); d.wire([(715,345),(790,345)],POWER,True)
    d.text(475,430,'Power GND', 'small');d.wire([(585,455),(585,492),(350,492)],GROUND,True)
    d.wire([(350,492),(350,395)],GROUND);d.dot(350,395,GROUND);d.text(30,511,'Supply − joins at the return point; load current does not pass through the ECU.','small')
    d.text(745,425,'Use driver-specified','small');d.text(745,450,'load suppression.','small');d.save('pwm')

    d=Drawing('Relay control and switched power','Nonisolated module: its IN must accept 3.3 V. Module VCC is its rated supply.')
    d.box(30,170,245,310,'ESP32 ECU');d.box(440,170,285,310,'Relay module');d.box(795,280,180,160,'Lamp / load')
    d.text(255,250,'On/off GPIO','','end');d.text(460,250,'IN');d.wire([(275,260),(440,260)])
    d.text(255,410,'GND','','end');d.text(460,410,'GND');d.wire([(275,420),(440,420)],GROUND)
    d.text(30,120,'Module-rated regulated supply + → VCC');d.wire([(550,130),(550,170)],POWER)
    d.text(545,220,'Coil driver', 'small');d.text(545,248,'inside module','small')
    d.text(755,144,'Fused load +','small');d.wire([(850,155),(750,155),(750,285),(725,285)],POWER,True)
    d.text(695,278,'COM','','end');d.text(695,334,'NO','','end');d.text(695,385,'NC unused','small','end')
    d.wire([(725,345),(795,345)],POWER,True)
    d.wire([(885,440),(885,495),(350,495)],GROUND,True);d.wire([(350,495),(350,420)],GROUND);d.dot(350,420,GROUND)
    d.text(30,517,'Load − and module supply − join the supply return. Contacts do not power the coil.','small');d.save('relay')

    d=Drawing('Analog sensor signal conditioning','Example calculation: 0.5–4.5 V signal, 15 kΩ top and 10 kΩ bottom → 0.2–1.8 V.')
    d.box(30,165,240,270,'Pressure sensor');d.box(730,165,240,270,'ESP32 ECU')
    d.text(50,225,'OUT');d.wire([(270,235),(470,235),(470,280)])
    d.resistor(470,280,'15 kΩ');d.wire([(470,322),(470,355),(730,355)])
    d.text(750,342,'ADC GPIO');d.dot(470,355)
    d.wire([(470,355),(470,390)]);d.resistor(470,390,'10 kΩ');d.wire([(470,432),(470,480)],GROUND)
    d.wire([(150,435),(150,480),(850,480),(850,435)],GROUND);d.dot(470,480,GROUND)
    d.text(50,125,'Sensor VCC ← manufacturer-specified regulated supply');d.wire([(150,135),(150,165)],POWER)
    d.text(550,390,'Add filtering /','small');d.text(550,415,'protection for','small');d.text(550,440,'fault voltages.','small')
    d.text(30,517,'Divider ratio = 10 / (15 + 10) = 0.4. A divider alone is not transient protection.','small');d.save('pressure')

    d=Drawing('Measure an isolated 12 V battery','16 V maximum for this exercise; no charger, starter or inductive loads connected.')
    d.box(30,175,245,265,'12 V battery');d.box(730,175,240,265,'ESP32 ECU')
    d.text(50,230,'Positive');d.wire([(275,240),(345,240)],POWER)
    d.items.append('<rect x="345" y="229" width="55" height="22" fill="#101922" stroke="#b6c4d2" stroke-width="2"/>')
    d.text(345,216,'Fuse','small');d.wire([(400,240),(465,240),(465,265)],POWER)
    d.resistor(465,265,'68 kΩ top');d.wire([(465,307),(465,345),(730,345)])
    d.text(750,332,'ADC GPIO');d.dot(465,345);d.wire([(465,345),(465,375)])
    d.resistor(465,375,'12 kΩ bottom');d.wire([(465,417),(465,480)],GROUND)
    d.wire([(150,440),(150,480),(850,480),(850,440)],GROUND);d.dot(465,480,GROUND)
    d.text(50,415,'Source −');d.text(750,415,'GND')
    d.wire([(465,345),(630,345),(630,395)])
    d.wire([(612,395),(648,395)])
    d.wire([(612,410),(648,410)])
    d.wire([(630,410),(630,480)],GROUND);d.dot(630,480,GROUND)
    d.text(655,402,'100 nF','small');d.dot(465,345)
    d.text(30,517,'12 V → 1.80 V at ADC. Ratio in Hardware: 6.6667. Live engine buses need protection.','small');d.save('voltage')

    d=Drawing('Current measurement with a shunt amplifier','Bench only: INA180A1, gain 20, 0.1 Ω shunt, 0–1 A. Nominal output: 2 V/A.')
    d.box(340,275,300,220,'INA180A1 module');d.box(760,275,210,220,'ESP32 ECU')
    d.box(30,110,240,140,'Fused 5 V source');d.box(760,110,210,140,'DC load')
    d.text(250,155,'+','','end');d.text(780,155,'+');d.text(250,224,'−','','end');d.text(780,224,'−')
    d.wire([(270,165),(400,165)],POWER,True);d.items.append('<rect x="400" y="151" width="100" height="28" fill="#1c2b38" stroke="#b6c4d2" stroke-width="2"/>');d.wire([(500,165),(760,165)],POWER,True)
    d.wire([(270,235),(300,235),(300,500),(985,500),(985,235),(970,235)],GROUND,True)
    d.text(415,136,'0.1 Ω','small');d.text(340,255,'IN+');d.text(570,255,'IN−');d.wire([(385,165),(385,275)]);d.wire([(570,165),(570,275)]);d.dot(385,165,POWER);d.dot(570,165,POWER)
    d.text(620,352,'OUT','','end');d.text(780,352,'ADC GPIO');d.wire([(640,362),(760,362)])
    d.text(360,414,'VS = 3.3 V');d.text(360,465,'GND');d.text(780,414,'3.3 V');d.text(780,465,'GND')
    d.wire([(640,425),(760,425)],POWER);d.wire([(640,475),(760,475)],GROUND)
    d.wire([(695,475),(695,500)],GROUND);d.dot(695,475,GROUND);d.dot(695,500,GROUND)
    d.text(30,410,'Supply − joins logic GND.','small');d.text(30,440,'100 nF: VS to GND.','small');d.text(30,470,'Kelvin sense at shunt.','small')
    d.text(30,519,'Use a ≥0.5 W shunt. This circuit is not a starter/pump power design or an isolated sensor.','small');d.save('current')

    # Public reference drawings share the same palette, terminals and legend.
    d=Drawing('ECU overview: signals and power','Functional map — choose actual GPIOs in Hardware; module pin order is not shown.')
    d.box(30,115,265,95,'ECU supply')
    d.text(48,183,'Fuse + board-rated regulator','small')
    d.box(715,115,255,95,'Separate load supply')
    d.text(733,183,'Individually fused branches','small')
    d.box(30,310,265,170,'Conditioned inputs')
    for y,label in [(375,'N1 / N2 pulses'),(407,'Thermocouple converter'),(439,'Pressure / throttle / switch')]:d.text(48,y,label,'small')
    d.box(370,260,260,220,'ESP32 ECU')
    d.text(390,338,'Hardware + calibration','small')
    d.text(390,375,'Controllers + protection','small')
    d.text(390,412,'Startup / shutdown','small')
    d.text(390,449,'3.3 V logic commands','small')
    d.box(715,235,255,85,'Independent stop')
    d.text(733,300,'Removes hazardous energy','small')
    d.box(715,365,255,115,'Rated drivers + loads')
    d.text(733,426,'Pump / starter / valve','small')
    d.text(733,457,'Ignition / auxiliaries','small')
    d.wire([(295,165),(500,165),(500,260)],POWER)
    d.text(335,146,'Regulated ECU power','small')
    d.wire([(295,400),(370,400)])
    d.wire([(630,400),(715,400)])
    d.wire([(843,210),(843,235)],POWER,True)
    d.wire([(843,320),(843,365)],POWER,True)
    d.text(30,517,'Plan signal reference and load returns separately; isolated interfaces follow their own design.','small')
    d.save('reference-overview')
    overview=(OUT/'reference-overview.svg').read_text()
    (OUT.parent/'ecu-wiring-overview.svg').write_text(overview, encoding='utf-8')
    (OUT/'reference-overview.svg').unlink()
    panels=[]
    for n,(name,x,y) in enumerate([('pressure',0,0),('rpm',1000,0),('switch',0,600),('thermocouple',1000,600)]):
        svg=(OUT/(name+'.svg')).read_text()
        svg=svg.replace('viewBox="0 0 1000 600"',f'x="{x}" y="{y}" width="1000" height="600" viewBox="0 0 1000 600"')
        svg=svg.replace('id="title"',f'id="title-{n}"').replace('id="desc"',f'id="desc-{n}"').replace('aria-labelledby="title desc"',f'aria-labelledby="title-{n} desc-{n}"')
        panels.append(svg)
    (OUT.parent/'sensor-switch-wiring.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1200" role="img" aria-label="Conditioned pressure, Hall speed, dry contact and thermocouple wiring patterns">'+''.join(panels)+'</svg>\n', encoding='utf-8')

    for level in (1,2,3):
        d=Drawing(f'Level {level}: one system that grows','Functional map — wiring details live in the individual steps. Orange borders mark additions.')
        d.box(360,115,280,370,'OpenTurbine ECU')
        d.text(500,260,'Hardware', '', 'middle');d.text(500,308,'Controllers + protection','','middle');d.text(500,356,'Sequence + calibration','','middle')
        d.text(500,415,'Physical Start / Stop','','middle')
        inputs=[('N1 pulses',1),('Turbine temperature',1),('Throttle',1),('Pressure + brightness knob',2),('N2 + auxiliary sensing',3),('Torque + I²C thrust',3)]
        outputs=[('Starter signal',1),('Ignition command',1),('Fuel command',1),('Shutoff + oil + light',2),('Fan + instrumentation',3)]
        for column,items in ((0,inputs),(1,outputs)):
            for i,(label,added) in enumerate(items):
                if added>level:continue
                x=30 if column==0 else 690;y=125+i*65
                d.box(x,y,280,52,label)
                if added==level and level>1:d.items.append(f'<rect x="{x}" y="{y}" width="280" height="52" rx="10" fill="none" stroke="#ff9276" stroke-width="3"/>')
                d.wire([(310 if column==0 else 640,y+26),(360 if column==0 else 690,y+26)])
        d.text(30,517,'Independent physical stop removes fuel / relevant load energy outside this software map.','small');d.save(f'level-{level}')


if __name__=='__main__':
    main()
