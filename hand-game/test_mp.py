import mediapipe as mp

print("Checking mp.tasks...")
try:
    print("mp.tasks:", mp.tasks)
    print("mp.tasks dir:", dir(mp.tasks))
except Exception as e:
    print("Error accessing mp.tasks:", e)

print("\nAttempting 'from mediapipe import solutions'...")
try:
    from mediapipe import solutions
    print("Success importing solutions directly")
except ImportError as e:
    print("Failed importing solutions directly:", e)
