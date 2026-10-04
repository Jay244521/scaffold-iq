import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

from scrapers import dcad_ingest as ing


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


def test_cleaning_helpers():
    s = pd.Series(["$1,234.50", " 99 ", "", "n/a"])
    assert ing.clean_money(s).tolist()[:2] == [1234.5, 99.0]
    assert ing.clean_money(s).isna().tolist()[2:] == [True, True]
    assert ing.clean_account_num(pd.Series([" 1000000 ", "776533000000.0", "ABC1"])).tolist() == [
        "00000000001000000", "00000776533000000", "ABC1",
    ]
    sqft = ing.area_to_sqft(pd.Series(["1", "500", "3"]), pd.Series(["ACRES", "SQUARE FEET", "FRONT FEET"]))
    assert sqft[0] == 43_560 and sqft[1] == 500 and pd.isna(sqft[2])


def test_values_keep_latest_year(external_dir):
    values = ing.load_values(external_dir / "ACCOUNT_APPRL_YEAR.CSV")
    row = values.set_index("account_num").loc["00000000001000000"]
    assert row["appraisal_year"] == 2025
    assert (row["land_value"], row["improvement_value"]) == (100_000, 20_000)
    # Blank improvement value means vacant land.
    assert values.set_index("account_num").loc["00000000002000000", "improvement_value"] == 0


def test_pipeline_filters_and_writes_csv(external_dir, tmp_path):
    out = tmp_path / "out.csv"
    result = ing.run(external_dir=external_dir, out_path=out, max_ratio=0.30, min_lot_sqft=10_000)

    # 1: ratio 0.20, 14,000 sf (two land sections)  -> kept
    # 2: ratio 0.00, 0.5 ac = 21,780 sf               -> kept, ranked first
    # 3: ratio 8.00                                    -> too improved
    # 4: land value 0                                  -> ratio undefined, no lot size
    # 5: BPP division                                  -> excluded
    assert result["account_num"].tolist() == ["00000000002000000", "00000000001000000"]

    first = result.iloc[1]
    assert first["impr_land_ratio"] == pytest.approx(0.20)
    assert first["lot_sqft"] == 14_000
    assert first["zoning"] == "R-7.5(A)"  # from the larger land section
    assert first["address"] == "100 MAIN ST"
    assert first["zip_code"] == "75201"
    assert first["land_value_per_sqft"] == pytest.approx(7.14)

    written = pd.read_csv(out, dtype={"account_num": str, "zip_code": str})
    assert list(written.columns) == ing.OUTPUT_COLUMNS
    assert len(written) == 2


def test_min_lot_size_filter(external_dir, tmp_path):
    result = ing.run(external_dir=external_dir, out_path=tmp_path / "o.csv", min_lot_sqft=15_000)
    assert result["account_num"].tolist() == ["00000000002000000"]


def test_geometry_fills_lot_size_and_coordinates(external_dir, tmp_path):
    (external_dir / "LAND.CSV").unlink()
    # Squares in Texas North Central ft-US, keyed by GIS_PARCEL_ID like DCAD's parcel layer.
    gdf = gpd.GeoDataFrame(
        {"GIS_PARCEL_ID": ["G1", "G2"]},
        geometry=[box(2_490_000, 6_970_000, 2_490_100, 6_970_150),   # 15,000 sf
                  box(2_491_000, 6_971_000, 2_491_050, 6_971_100)],  #  5,000 sf
        crs=ing.AREA_CRS,
    )
    gdf.to_file(external_dir / "parcels.gpkg")

    result = ing.run(external_dir=external_dir, out_path=tmp_path / "o.csv", min_lot_sqft=10_000)
    assert result["account_num"].tolist() == ["00000000001000000"]
    row = result.iloc[0]
    assert row["lot_sqft"] == pytest.approx(15_000)
    assert row["lot_size_source"] == "parcel_geometry"
    assert 32.5 < row["latitude"] < 33.2 and -97.2 < row["longitude"] < -96.4  # Dallas area


def test_missing_required_column_is_reported(tmp_path):
    pd.DataFrame({"ACCOUNT_NUM": ["1"], "LAND_VAL": ["1"]}).to_csv(tmp_path / "ACCOUNT_APPRL_YEAR.CSV", index=False)
    with pytest.raises(ValueError, match="improvement_value"):
        ing.load_values(tmp_path / "ACCOUNT_APPRL_YEAR.CSV")
