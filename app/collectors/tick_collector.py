import asyncio
import websockets
import json
from datetime import datetime, timedelta
from app.extensions import db
from app.models.tick_data import TickData
import threading
import time
from threading import Lock, Event
from collections import defaultdict
import psutil
import gc
from flask import current_app

class ServerTickCollector:
    def __init__(self, app):
        self.app = app
        self.ws = None
        self.markets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']
        self.running = False
        self._shutdown_event = Event()
        self._print_time_lock = Lock()
        self._last_print_times = defaultdict(float)
        
        # Add debug_mode attribute
        self.debug_mode = app.debug if app else False
        
        # Configuration
        self.connection_timeout = 30
        self.max_reconnect_attempts = 3
        self.reconnect_delay = 5
        
        # PythonAnywhere specific configs
        self.max_memory_mb = 300  # Conservative memory limit
        self.gc_threshold = 200   # MB before forcing garbage collection
        
    def start(self):
        """Start the collector in a separate thread"""
        def run_collector():
            with self.app.app_context():
                asyncio.run(self.connect())

        collector_thread = threading.Thread(target=run_collector)
        collector_thread.daemon = True
        collector_thread.start()
        
    async def connect(self):
        """Connect to WebSocket"""
        try:
            if self.debug_mode:
                print("Starting tick collector...")
            self.ws = await websockets.connect('wss://ws.binaryws.com/websockets/v3?app_id=1089')
            self.running = True
            
            await self.subscribe_to_markets()
            await self.collect_ticks()
        except Exception as e:
            print(f"❌ Connection error: {str(e)}")
            await self.reconnect()
            
    async def periodic_cleanup(self):
        while self.running:
            await asyncio.sleep(self.cleanup_interval)
            await self.cleanup_old_data()
            
    async def subscribe_to_markets(self):
        """Subscribe to market updates"""
        if self.debug_mode:
            print("Subscribing to markets...")
            
        for market in self.markets:
            await self.ws.send(json.dumps({
                'ticks': market,
                'subscribe': 1
            }))
            if self.debug_mode:
                print(f"Subscribed to {market}")
                
    async def collect_ticks(self):
        """Optimized tick collection"""
        if self.debug_mode:
            print("Starting tick collection...")
            
        reconnect_attempts = 0
        
        while not self._shutdown_event.is_set():
            try:
                self._check_resources()
                message = await asyncio.wait_for(
                    self.ws.recv(),
                    timeout=self.connection_timeout
                )
                data = json.loads(message)
                if 'tick' in data:
                    await self.save_tick(data['tick'])
                    reconnect_attempts = 0  # Reset on successful operation
                    
            except asyncio.TimeoutError:
                current_app.logger.warning("Tick collection timeout")
                await self.reconnect()
                
            except Exception as e:
                reconnect_attempts += 1
                if reconnect_attempts > self.max_reconnect_attempts:
                    current_app.logger.error("Max reconnection attempts reached")
                    self._shutdown_event.set()
                    break
                    
                current_app.logger.error(f"Error collecting ticks: {e}")
                await asyncio.sleep(self.reconnect_delay)
                await self.reconnect()
                
    def _update_last_print_time(self, market):
        with self._print_time_lock:
            self._last_print_times[market] = time.time()
            
    def _should_print_update(self, market):
        with self._print_time_lock:
            current_time = time.time()
            return (market not in self._last_print_times or 
                   current_time - self._last_print_times[market] >= 60)

    async def save_tick(self, tick_data):
        try:
            tick = TickData(
                market=tick_data['symbol'],
                price=float(tick_data['quote']),
                timestamp=datetime.fromtimestamp(tick_data['epoch'])
            )
            db.session.add(tick)
            db.session.commit()
            
            # Use thread-safe print time checking
            if self._should_print_update(tick_data['symbol']):
                print(f"✓ Market Update: {tick_data['symbol']} @ {tick_data['quote']}")
                self._update_last_print_time(tick_data['symbol'])
                
        except Exception as e:
            print(f"❌ Error: {e}")
            db.session.rollback()
        
    async def reconnect(self):
        """Handle reconnection"""
        if self.debug_mode:
            print("Attempting to reconnect...")
            
        self.running = False
        if self.ws:
            await self.ws.close()
        await asyncio.sleep(self.reconnect_delay)
        await self.connect()
        
    async def cleanup_old_data(self):
        try:
            print("Cleaning up old tick data...")
            cutoff = datetime.now() - timedelta(days=3)
            TickData.query.filter(TickData.timestamp < cutoff).delete()
            db.session.commit()
            print("Cleanup completed")
        except Exception as e:
            print(f"Error during cleanup: {e}")
            db.session.rollback()

    def stop(self):
        """Stop the collector"""
        self._shutdown_event.set()
        self.running = False
        
    def _check_resources(self):
        """Basic resource management"""
        gc.collect()  # Force garbage collection periodically
            
        memory_used = psutil.Process().memory_info().rss / (1024 * 1024)  # MB
        if memory_used > self.gc_threshold:
            gc.collect()  # Force garbage collection
        if memory_used > self.max_memory_mb:
            raise MemoryError(f"Memory usage ({memory_used}MB) exceeded limit")
  