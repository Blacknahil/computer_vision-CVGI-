import cv2
import mediapipe as mp

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# Use 'with' to ensure resources are cleaned up automatically
with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6,
) as hands:

    cap = cv2.VideoCapture(0)

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Get frame dimensions for pixel conversion
        h, w, c = frame.shape

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(frame_rgb)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame, hand_landmarks, mp_hands.HAND_CONNECTIONS
                )

                # Example: Get the Tip of the Index Finger (Landmark 8)
                index_finger_tip = hand_landmarks.landmark[8]
                pixel_x, pixel_y = int(index_finger_tip.x * w), int(index_finger_tip.y * h)
                
                # Draw a custom circle on the index tip
                cv2.circle(frame, (pixel_x, pixel_y), 10, (0, 255, 0), -1)

        cv2.imshow("Hand Tracking", frame)

        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()