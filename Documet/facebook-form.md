# Facebook Form Utilities

This directory provides small scripts to mock or generate Facebook lead data for the rest of the project.

## FacebookGraph.py

- Implements a Flask server that returns the contents of `sample_lead.json` for any `leadgen_id` requested. The endpoint reads the file, overrides the `leadgen_id`, and responds with JSON.
- All code is currently commented out, but it demonstrates how to load the sample data and serve it from `/lead`.

## FinishFacebookInstantForm.py

- Builds a lead payload using `Faker` and random choices. The structure includes names, phone, address, and other home details:

```python
self.lead_data = {
    "leadgen_id": leadgen_id,
    "full_name": self.fake.name(),
    "phone": "+46762134268",
    "address": self.fake.address().replace("\n", ", "),
    "lead_state": random.choice(["Hot", "Warm", "Cold"]),
    "home_type": random.choice(["Single Family", "Condo", "Townhouse", "Mobile Home", "Land"]),
    "home_built": random.choice(["2000 or later", "1990s", "1980s", "1970s", "1960s", "Before 1960"]),
    "home_worth": random.choice(["$300K or less", "$300K - $600K", "$600K - $900K", "$900K - $1.2M", "$1.2M or more"]),
    "sell_time": random.choice(["ASAP", "1-3 months", "3-6 months", "6-12 months", "12+ months"]),
    "home_condition": random.choice(["Needs nothing", "Needs a little work", "Needs significant work", "Tear down"]),
    "working_with_agent": random.choice(["No", "Yes"]),
    "looking_to_buy": random.choice(["No", "Yes"]),
    "ad_id": "AD" + str(random.randint(10000, 99999)),
    "tracking_parameters": "utm_source=" + tracking_parameter,
    "uuid": target_realtor_uuid
}
```

- Posts this payload to a webhook (`http://142.93.178.215:5002/webhook`) and prints out a landing page URL based on the realtor ID.
- Useful for locally testing integrations that expect Facebook lead submissions.
