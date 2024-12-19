import json
import websockets
import asyncio
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class DerivAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.ws_url = "wss://ws.binaryws.com/websockets/v3?app_id=1089"
        
    async def connect(self):
        try:
            async with websockets.connect(
                self.ws_url,
                subprotocols=['binary', 'websockets'],
                user_agent_header="AetherTrade/1.0.0"
            ) as websocket:
                auth_req = {
                    "authorize": self.api_key,
                    "req_id": 1
                }
                
                # Log the request
                logger.debug(f"Sending authorization request: {auth_req}")
                
                await websocket.send(json.dumps(auth_req))
                response = await websocket.recv()
                response_data = json.loads(response)
                
                # Log the response
                logger.debug(f"Received response: {response_data}")
                
                # Check for specific response patterns
                if "error" in response_data:
                    logger.error(f"API Error: {response_data['error']}")
                    return response_data
                
                if "authorize" in response_data:
                    # Successful authorization
                    if response_data.get("authorize"):
                        logger.info("Authorization successful")
                        return {"success": True, "data": response_data}
                    
                return response_data
                
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return {"error": {"message": error_msg}}

    async def get_account_info(self):
        try:
            async with websockets.connect(
                self.ws_url,
                subprotocols=['binary', 'websockets']
            ) as websocket:
                # Authorize
                auth_req = {
                    "authorize": self.api_key,
                    "req_id": 1
                }
                await websocket.send(json.dumps(auth_req))
                auth_response = await websocket.recv()
                
                if "error" in json.loads(auth_response):
                    return json.loads(auth_response)
                
                # Get balance
                balance_req = {
                    "balance": 1,
                    "subscribe": 1,
                    "req_id": 2
                }
                await websocket.send(json.dumps(balance_req))
                balance_response = await websocket.recv()
                
                return json.loads(balance_response)
                
        except Exception as e:
            return {"error": {"message": f"Error getting account info: {str(e)}"}}

    async def create_trade(self, contract_type, amount, symbol, duration, duration_unit):
        try:
            async with websockets.connect(self.ws_url) as websocket:
                # Authorize
                auth_req = {
                    "authorize": self.api_key,
                    "req_id": 1
                }
                await websocket.send(json.dumps(auth_req))
                auth_response = await websocket.recv()
                
                if "error" in json.loads(auth_response):
                    return json.loads(auth_response)
                
                # Create proposal
                proposal_req = {
                    "proposal": 1,
                    "amount": amount,
                    "barrier": None,
                    "basis": "stake",
                    "contract_type": contract_type,
                    "currency": "USD",
                    "duration": duration,
                    "duration_unit": duration_unit,
                    "symbol": symbol,
                    "req_id": 2
                }
                
                await websocket.send(json.dumps(proposal_req))
                proposal_response = await websocket.recv()
                
                return json.loads(proposal_response)
                
        except Exception as e:
            return {"error": {"message": f"Error creating trade: {str(e)}"}}

    async def ping(self):
        """Simple ping to test connection"""
        try:
            async with websockets.connect(
                self.ws_url,
                subprotocols=['binary', 'websockets']
            ) as websocket:
                ping_req = {
                    "ping": 1,
                    "req_id": 1
                }
                await websocket.send(json.dumps(ping_req))
                response = await websocket.recv()
                return json.loads(response)
        except Exception as e:
            return {"error": {"message": f"Ping failed: {str(e)}"}}