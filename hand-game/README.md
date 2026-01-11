# Hand-Controlled Space Shooter

A React-based space shooter controlled by your hand gestures via webcam.

## How to Run

### 1. Start the Hand Tracker (Backend)
Run this locally to access your webcam:
```bash
pip install -r requirements.txt
python main.py
```
*Keep this terminal open.*

### 2. Start the Game (Frontend)
Open a new terminal and run:
```bash
docker-compose up game
```
Then open **[http://localhost:5173](http://localhost:5173)**.

---

## Controls
*   **Move Ship**: Move your hand left/right.
*   **Throttle**: Move hand **Up** (Fast) or **Down** (Slow).
*   **Shoot**: **Pinch** your Index Finger and Thumb.
