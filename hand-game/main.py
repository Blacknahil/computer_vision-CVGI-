import cv2
import mediapipe as mp
import asyncio
import websockets
import json
import math
import os
import urllib.request
import time
import base64

# --- Global Configuration ---
PORT = 8765
PINCH_THRESHOLD = 0.05 
MODEL_PATH = 'hand_landmarker.task'
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

def distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

def download_model():
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading model from {MODEL_URL}...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print("Download complete.")
        except Exception as e:
            print(f"Failed to download model: {e}")
            raise

def draw_landmarks_on_image(rgb_image, detection_result):
    hand_landmarks_list = detection_result.hand_landmarks
    
    # We need to convert back to BGR for OpenCV drawing if we want to use cv2
    # But mp.Image data is immutable? 
    # Let's perform drawing on a mutable copy of the numpy array
    annotated_image = rgb_image.copy() # is this numpy? yes
    
    # Iterate over the detected hands
    for hand_landmarks in hand_landmarks_list:
        # Draw the skeleton
        for i in range(len(hand_landmarks) - 1):
             # Simple line drawing between connected points would require a map
             # For simplicity in this "draw yourself" mode (since solutions is missing)
             # Let's just draw points
             pass

        # Draw points
        h, w, _ = annotated_image.shape
        for lm in hand_landmarks:
            cx, cy = int(lm.x * w), int(lm.y * h)
            cv2.circle(annotated_image, (cx, cy), 5, (0, 255, 0), -1)
            
    return annotated_image

async def handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    
    # --- MediaPipe Tasks Setup ---
    BaseOptions = mp.tasks.BaseOptions
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    # Create a landmarker instance with video mode:
    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    
    # --- Webcam setup ---
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        await websocket.send(json.dumps({"error": "Webcam not found"}))
        return

    # Set native capture res
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("Streaming hand data...")

    landmarker = HandLandmarker.create_from_options(options)

    try:
        start_time = time.time()
        
        while True:
            # Check connection
            try:
                await websocket.ping()
            except websockets.exceptions.ConnectionClosed:
                print("Client disconnected.")
                break

            ok, frame = cap.read()
            if not ok:
                print("Failed to read frame.")
                break

            # Flip
            frame = cv2.flip(frame, 1)
            # Convert to RGB for MP
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Create MP Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            # Detect
            timestamp_ms = int((time.time() - start_time) * 1000)
            detection_result = landmarker.detect_for_video(mp_image, timestamp_ms)
            
            data = {
                "detected": False,
                "x": 0.5,
                "y": 0.5,
                "shooting": False,
                "image": ""
            }

            if detection_result.hand_landmarks:
                hand_landmarks = detection_result.hand_landmarks[0]
                index_tip = hand_landmarks[8]
                thumb_tip = hand_landmarks[4]
                
                dist = distance(index_tip, thumb_tip)
                is_pinching = dist < PINCH_THRESHOLD
                
                data["detected"] = True
                data["x"] = index_tip.x
                data["y"] = index_tip.y
                data["shooting"] = is_pinching
                
                # Draw landmarks on the frame for visualization
                # We draw on BGR frame for opencv encoding
                h, w, _ = frame.shape
                for lm in hand_landmarks:
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (cx, cy), 5, (0, 255, 0), -1)
                
                # Draw pinch line
                if is_pinching:
                     cv2.line(frame, 
                              (int(index_tip.x*w), int(index_tip.y*h)), 
                              (int(thumb_tip.x*w), int(thumb_tip.y*h)), 
                              (0, 0, 255), 3)

            # Resize for transmission (reduce bandwidth)
            small_frame = cv2.resize(frame, (320, 240))
            
            # Encode to JPEG
            _, buffer = cv2.imencode('.jpg', small_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            b64_image = base64.b64encode(buffer).decode('utf-8')
            
            data["image"] = f"data:image/jpeg;base64,{b64_image}"

            await websocket.send(json.dumps(data))
            await asyncio.sleep(0.033) # ~30 FPS
            
    except Exception as e:
        print(f"Error in handler: {e}")
    finally:
        cap.release()
        landmarker.close()
        print("Cleanup done.")

async def main():
    download_model()
    print(f"Starting WebSocket server on port {PORT}...")
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.get_running_loop().create_future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")

