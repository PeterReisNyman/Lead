import requests
import json
import uuid
import random
from faker import Faker

class FinishFacebookInstantForm:
    def __init__(self):
        self.lead_data = {}
        self.fake = Faker()

    def simulate_form_submission(self):
        # Generate a unique UUID for leadgen_id and tracking
        leadgen_id = str(uuid.uuid4())
        tracking_parameter = str(uuid.uuid4())
        
        # Define the realtor UUID you want to associate this lead with
        # Using the one from your schema/sample data
        target_realtor_uuid = "f957761b-104e-416e-a550-25e010ca9302" 

        self.lead_data = {
            "leadgen_id": leadgen_id, # Still useful maybe, but not essential for fetch
            "full_name": self.fake.name(),
            "phone": "+46762134268",#self.fake.phone_number(),
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
            "uuid": target_realtor_uuid # The UUID of the Realtor
        }

        # --- NO LONGER NEED TO WRITE TO sample_lead.json ---
        # file_path = os.path.join('FacebookForm', 'sample_lead.json')
        # os.makedirs(os.path.dirname(file_path), exist_ok=True)
        # with open(file_path, 'w') as f:
        #     json.dump(self.lead_data, f)
        
        # --- SEND THE ENTIRE lead_data OBJECT ---
        # Ensure this points to your SERVER's intermediary service
        webhook_url = "http://142.93.178.215:5002/webhook"
        payload = self.lead_data # Send the full data object

        try:
            print(f"Sending lead data to: {webhook_url}")
            print("Payload:", json.dumps(payload, indent=2)) # Log the payload being sent
            
            response = requests.post(webhook_url, json=payload)
            response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
            
            print(f"Webhook sent. Status Code: {response.status_code}, Response: {response.text}")
            
            # Generate and display the Site URL for the specific realtor
            # Ensure you replace localhost with your server IP if accessing remotely
            site_base_url = "www.myrealvaluation.com" # Use server IP
            leadgen_url = f"{site_base_url}/{target_realtor_uuid}?utm_source={tracking_parameter}"
            print("\nYour unique landing page URL:")
            print("=" * 50)
            print(leadgen_url)
            print("=" * 50)
            
            return leadgen_url
            
        except requests.exceptions.RequestException as e:
            print(f"Error sending webhook: {e}")
            if e.response is not None:
                print(f"Server Response Status Code: {e.response.status_code}")
                print(f"Server Response Body: {e.response.text}")
            return None

if __name__ == "__main__":
    form = FinishFacebookInstantForm()
    form.simulate_form_submission()




# import requests
# import json
# import uuid
# import random
# from faker import Faker

# class FinishFacebookInstantForm:
#     def __init__(self):
#         self.lead_data = {}
#         self.fake = Faker()

#     def simulate_form_submission(self):
#         # Generate a unique UUID for leadgen_id and tracking
#         leadgen_id = str(uuid.uuid4())
#         tracking_parameter = str(uuid.uuid4())
        
#         self.lead_data = {
#             "leadgen_id": leadgen_id,
#             "full_name": self.fake.name(),
#             "phone": self.fake.phone_number(),
#             "address": self.fake.address().replace("\n", ", "),
#             "lead_state": random.choice(["Hot", "Warm", "Cold"]),
#             "home_type": random.choice(["Single Family", "Condo", "Townhouse", "Mobile Home", "Land"]),
#             "home_built": random.choice(["2000 or later", "1990s", "1980s", "1970s", "1960s", "Before 1960"]),
#             "home_worth": random.choice(["$300K or less", "$300K - $600K", "$600K - $900K", "$900K - $1.2M", "$1.2M or more"]),
#             "sell_time": random.choice(["ASAP", "1-3 months", "3-6 months", "6-12 months", "12+ months"]),
#             "home_condition": random.choice(["Needs nothing", "Needs a little work", "Needs significant work", "Tear down"]),
#             "working_with_agent": random.choice(["No", "Yes"]),
#             "looking_to_buy": random.choice(["No", "Yes"]),
#             "ad_id": "AD" + str(random.randint(10000, 99999)),
#             "tracking_parameters": "utm_source=" + tracking_parameter,
#             "uuid": "f957761b-104e-416e-a550-25e010ca9302"
#         }

#         # Save the generated lead data to a file for FacebookGraph.py to retrieve later
#         with open('FacebookForm/sample_lead.json', 'w') as f:
#             json.dump(self.lead_data, f)
        
#         # Simulate sending a webhook (HTTP POST) to the Intermediary endpoint
#         webhook_url = "http://localhost:5002/webhook"
#         payload = {"leadgen_id": leadgen_id}
        
#         try:
#             response = requests.post(webhook_url, json=payload)
#             print(f"Webhook sent. Response: {response.text}")
            
#             # Generate and display the Site URL with tracking parameter
#             leadgen_url = f"http://localhost:5050/f957761b-104e-416e-a550-25e010ca9302?utm_source={tracking_parameter}"
#             print("\nYour unique landing page URL:")
#             print("=" * 50)
#             print(leadgen_url)
#             print("=" * 50)
            
#             return leadgen_url
            
#         except Exception as e:
#             print(f"Error sending webhook: {e}")
#             return None

# if __name__ == "__main__":
#     form = FinishFacebookInstantForm()
#     form.simulate_form_submission()

