import pandas as pd
import pytest


@pytest.fixture
def external_dir(tmp_path):
    """A small DCAD-shaped export: mixed-case headers, $/comma values, two years."""
    pd.DataFrame(
        {
            "ACCOUNT_NUM": [" 00000000001000000", "00000000001000000", "00000000002000000",
                            "00000000003000000", "00000000004000000", "00000000005000000"],
            "APPRAISAL_YR": ["2024", "2025", "2025", "2025", "2025", "2025"],
            "LAND_VAL": ["$90,000", "$100,000", "200000", "50,000", "0", "80000"],
            "IMPR_VAL": ["5,000", "$20,000", "", "400,000", "10000", "10000"],
            "TOT_VAL": ["95000", "120000", "200000", "450000", "10000", "90000"],
        }
    ).to_csv(tmp_path / "ACCOUNT_APPRL_YEAR.CSV", index=False)

    pd.DataFrame(
        {
            "ACCOUNT_NUM": ["00000000001000000", "00000000002000000", "00000000003000000",
                            "00000000004000000", "00000000005000000"],
            "APPRAISAL_YR": ["2025"] * 5,
            "DIVISION_CD": ["RES", "COM", "COM", "RES", "BPP"],
            "OWNER_NAME1": ["SMITH JOHN", "ACME LLC", "BIG BOX INC", "DOE JANE", "SHOP CO"],
            "STREET_NUM": ["100", "200", "300", "400", "500"],
            "FULL_STREET_NAME": ["MAIN  ST", "ELM ST", "COMMERCE ST", "ROSS AVE", "OAK LAWN AVE"],
            "PROPERTY_CITY": ["DALLAS"] * 5,
            "PROPERTY_ZIPCODE": ["75201-1234", "75202", "75203", "75204", "75205"],
            "GIS_PARCEL_ID": ["G1", "G2", "G3", "G4", "G5"],
        }
    ).to_csv(tmp_path / "ACCOUNT_INFO.CSV", index=False)

    pd.DataFrame(
        {
            "account_num": ["00000000001000000", "00000000001000000", "00000000002000000",
                            "00000000003000000", "00000000005000000"],
            "appraisal_yr": ["2025"] * 5,
            "zoning": ["R-7.5(A)", "MF-2(A)", "", "CA-1(A)", "CA-1(A)"],
            "area_size": ["8,000", "6,000", "0.5", "30000", "20000"],
            "area_uom_desc": ["SQUARE FEET", "SQUARE FEET", "ACRES", "SQUARE FEET", "SQUARE FEET"],
        }
    ).to_csv(tmp_path / "LAND.CSV", index=False)
    return tmp_path
