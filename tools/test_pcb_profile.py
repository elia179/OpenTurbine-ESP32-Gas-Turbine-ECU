import copy
import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "pcb_profile", ROOT / "tools" / "pcb_profile.py"
)
pcb_profile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pcb_profile)


class PcbProfileValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.official = json.loads(
            (ROOT / "pcb_profiles" / "official" /
             "openturbine-ecu-s3-v1.otpcb.json").read_text(encoding="utf-8")
        )

    def test_classic_rejects_s3_profile_format(self):
        profile = copy.deepcopy(self.official)
        profile["target"]["chip"] = "esp32"
        profile["format_version"]["minor"] = 1
        with self.assertRaisesRegex(pcb_profile.ProfileError, "Classic ESP32 supports format 1.0"):
            pcb_profile.validate_profile(profile, strict=True)

    def test_official_profile_matches_runtime_text_limits(self):
        self.assertEqual([], pcb_profile.validate_profile(self.official, strict=True))

    def test_port_description_too_long_is_rejected_before_flash(self):
        profile = copy.deepcopy(self.official)
        profile["ports"][0]["description"] = "x" * 80
        with self.assertRaisesRegex(
            pcb_profile.ProfileError, "description must be at most 79"
        ):
            pcb_profile.validate_profile(profile, strict=True)

    def test_port_connector_too_long_is_rejected_before_flash(self):
        profile = copy.deepcopy(self.official)
        profile["ports"][0]["connector"] = "x" * 24
        with self.assertRaisesRegex(
            pcb_profile.ProfileError, "connector must be at most 23"
        ):
            pcb_profile.validate_profile(profile, strict=True)

    def test_active_high_must_be_boolean(self):
        profile = copy.deepcopy(self.official)
        profile["ports"][0]["modes"][0]["active_high"] = "false"
        with self.assertRaisesRegex(
            pcb_profile.ProfileError, "active_high must be boolean"
        ):
            pcb_profile.validate_profile(profile, strict=True)

    def test_compatible_non_switch_default_is_accepted(self):
        profile = copy.deepcopy(self.official)
        mode = next(port for port in profile["ports"] if port["id"] == "adc_1")["modes"][0]
        mode["default"] = {
            "id": "oil_pressure_main", "name": "Oil Pressure",
            "role": "pressure", "purpose": "oil_pressure",
        }
        self.assertEqual([], pcb_profile.validate_profile(profile, strict=True))

    def test_incompatible_default_is_rejected_before_flash(self):
        profile = copy.deepcopy(self.official)
        mode = next(port for port in profile["ports"] if port["id"] == "power_output_1")["modes"][0]
        mode["default"] = {
            "id": "main_fuel", "name": "Main Fuel",
            "role": "fuel", "purpose": "main_fuel",
        }
        with self.assertRaisesRegex(pcb_profile.ProfileError, "incompatible with adapter"):
            pcb_profile.validate_profile(profile, strict=True)

    def test_general_sensor_capabilities(self):
        for purpose in ["oil_temperature", "coolant_temp", "intake_temperature", "general_temperature"]:
            for adapter in ["spi_thermocouple", "onewire_temperature"]:
                self.assertTrue(pcb_profile._default_compatible(adapter, purpose, "temperature"))
        for purpose, role in [("general_pressure","pressure"),("general_voltage","voltage"),("general_torque","torque"),("general_thrust","thrust")]:
            self.assertTrue(pcb_profile._default_compatible("i2c_adc_input",purpose,role))
        for purpose in ["digital_switch","chip_detector","diff_press_switch"]:
            self.assertTrue(pcb_profile._default_compatible("i2c_adc_digital_input",purpose,"digital_switch"))
        for purpose in ["tot","tit"]:
            self.assertFalse(pcb_profile._default_compatible("onewire_temperature",purpose,"temperature"))
        self.assertFalse(pcb_profile._default_compatible("pcnt_input","ab_command","operator"))

    def test_extended_profile_purposes_follow_runtime_contract(self):
        self.assertTrue(pcb_profile._default_compatible(
            "i2c_adc_input", "oil_flow", "flow"))
        self.assertTrue(pcb_profile._default_compatible(
            "i2c_adc_input", "scavenge_flow", "flow"))
        self.assertTrue(pcb_profile._default_compatible(
            "i2c_digital_output", "drain_valve", "valve"))
        self.assertTrue(pcb_profile._default_compatible(
            "spi_thermocouple", "coolant_temp", "temperature"))
        self.assertTrue(pcb_profile._default_compatible(
            "onewire_temperature", "intake_temperature", "temperature"))
        self.assertFalse(pcb_profile._default_compatible(
            "i2c_load_cell", "oil_pressure", "pressure"))
        self.assertFalse(pcb_profile._default_compatible(
            "relay_output", "main_fuel", "fuel"))
        self.assertTrue(pcb_profile._default_compatible(
            "analog_input", "generic", "pressure"))
        self.assertFalse(pcb_profile._default_compatible(
            "i2c_load_cell", "generic", "pressure"))


class CurrentBoardTests(unittest.TestCase):
    def setUp(self):
        self.profile=json.loads((ROOT/'pcb_profiles/official/openturbine-s3-20261028.otpcb.json').read_text(encoding='utf-8'))

    def test_current_board_geometry(self):
        pcb_profile.validate_profile(self.profile)
        self.assertEqual(self.profile['target']['minimum_flash_mb'],8)
        ports={p['id']:p for p in self.profile['ports']}
        self.assertEqual([ports[f'pulse_in_{i}']['modes'][0]['endpoint']['gpio'] for i in range(1,7)],[35,36,6,7,15,16])
        self.assertEqual([ports[f'power_out_{i}']['modes'][0]['endpoint']['gpio'] for i in range(1,7)],[37,38,41,42,2,1])
        self.assertEqual([ports[f'pulse_out_{i}']['modes'][0]['endpoint']['gpio'] for i in range(1,7)],[18,8,9,39,40,21])
        self.assertEqual(self.profile['fixed_functions']['supply_voltage']['divider'],37)

    def test_signal_outputs_offer_all_supported_waveforms(self):
        ports = {p["id"]: p for p in self.profile["ports"]}
        for n in range(1, 7):
            self.assertEqual(ports[f"pulse_out_{n}"]["label"], f"OUT {n}")
            self.assertEqual(ports[f"power_out_{n}"]["label"], f"PWM {n}")
            self.assertEqual({m["adapter"] for m in ports[f"pulse_out_{n}"]["modes"]}, {"servo_output", "pwm_output", "relay_output"})
            self.assertEqual(len({m["endpoint"]["gpio"] for m in ports[f"pulse_out_{n}"]["modes"]}), 1)
            self.assertEqual({m["adapter"] for m in ports[f"analog_{n}"]["modes"]}, {"i2c_adc_input", "i2c_adc_digital_input"})

    def test_shared_indicator_rejected(self):
        self.profile['fixed_functions']['fault_led']['channel']=6
        with self.assertRaises(pcb_profile.ProfileError): pcb_profile.validate_profile(self.profile)

    def test_pull_control_cannot_steal_indicator(self):
        for mode in self.profile['ports'][10]['modes']: mode['pull_control']['channel']=6
        with self.assertRaises(pcb_profile.ProfileError): pcb_profile.validate_profile(self.profile)

    def test_missing_control_device_rejected(self):
        self.profile['fixed_functions']['fault_led']['device']='not_fitted'
        with self.assertRaises(pcb_profile.ProfileError): pcb_profile.validate_profile(self.profile)


if __name__ == "__main__":
    unittest.main()
