# from flask import Flask, request, jsonify
# import json
# import os

# app = Flask(__name__)

# @app.route('/lead', methods=['GET'])
# def get_lead():
#     leadgen_id = request.args.get('leadgen_id')
#     print(f"Received request for leadgen_id: {leadgen_id}")
    
#     try:
#         # Try different possible file paths for the sample_lead.json
#         possible_paths = [
#             'sample_lead.json',
#             'FacebookForm/sample_lead.json',
#             os.path.join(os.path.dirname(__file__), 'sample_lead.json')
#         ]
        
#         lead_data = None
#         for path in possible_paths:
#             try:
#                 with open(path, 'r') as f:
#                     lead_data = json.load(f)
#                     print(f"Successfully loaded lead data from {path}")
#                     break
#             except Exception as e:
#                 print(f"Could not load from {path}: {e}")
#         # Override the leadgen_id to match what was requested
#         lead_data["leadgen_id"] = leadgen_id
#         print(f"Returning lead data for {leadgen_id}")
#         return jsonify(lead_data)
    
#     except Exception as e:
#         print(f"Error serving lead data: {e}")

# if __name__ == "__main__":
#     print("Starting Facebook API mock server on 0.0.0.0:5001")
#     print("Will accept any leadgen_id and return lead data")
#     app.run(host='0.0.0.0', port=5001, debug=True)
