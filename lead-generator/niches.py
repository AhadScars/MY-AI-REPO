"""Industry presets → OpenStreetMap tags."""

NICHES = {
    "dentist": {
        "label": "Dentists / dental clinics",
        "filters": ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
        "exclude_name": r"lab|laboratory|aspen dental|hello.?tend",
    },
    "plumber": {
        "label": "Plumbers",
        "filters": ['["craft"="plumber"]', '["shop"="plumber"]', '["office"="plumber"]'],
        "exclude_name": r"",
    },
    "electrician": {
        "label": "Electricians",
        "filters": ['["craft"="electrician"]', '["office"="electrician"]'],
        "exclude_name": r"",
    },
    "hvac": {
        "label": "HVAC / heating & cooling",
        "filters": ['["craft"="hvac"]', '["craft"="heating_engineer"]'],
        "exclude_name": r"",
    },
    "roofer": {
        "label": "Roofers",
        "filters": ['["craft"="roofer"]'],
        "exclude_name": r"",
    },
    "lawyer": {
        "label": "Lawyers / law offices",
        "filters": ['["office"="lawyer"]', '["office"="attorney"]'],
        "exclude_name": r"",
    },
    "accountant": {
        "label": "Accountants",
        "filters": ['["office"="accountant"]', '["office"="tax_advisor"]'],
        "exclude_name": r"",
    },
    "real_estate": {
        "label": "Real estate agents",
        "filters": ['["office"="estate_agent"]'],
        "exclude_name": r"",
    },
    "hairdresser": {
        "label": "Hair salons / barbers",
        "filters": ['["shop"="hairdresser"]', '["shop"="barber"]'],
        "exclude_name": r"",
    },
    "auto_repair": {
        "label": "Auto repair shops",
        "filters": ['["shop"="car_repair"]', '["amenity"="vehicle_inspection"]'],
        "exclude_name": r"",
    },
    "veterinarian": {
        "label": "Veterinarians",
        "filters": ['["amenity"="veterinary"]', '["healthcare"="veterinary"]'],
        "exclude_name": r"",
    },
    "chiropractor": {
        "label": "Chiropractors",
        "filters": ['["healthcare"="chiropractor"]', '["office"="chiropractor"]'],
        "exclude_name": r"",
    },
    "restaurant": {
        "label": "Restaurants",
        "filters": ['["amenity"="restaurant"]'],
        "exclude_name": r"",
    },
    "bakery": {
        "label": "Bakeries",
        "filters": ['["shop"="bakery"]'],
        "exclude_name": r"",
    },
    "florist": {
        "label": "Florists",
        "filters": ['["shop"="florist"]'],
        "exclude_name": r"",
    },
    "gym": {
        "label": "Gyms / fitness",
        "filters": ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'],
        "exclude_name": r"",
    },
}


def niche_choices():
    return [{"id": k, "label": v["label"]} for k, v in NICHES.items()]
