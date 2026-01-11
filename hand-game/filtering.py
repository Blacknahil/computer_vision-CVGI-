# kalman filter
import numpy as np
from collections import deque
import statistics

class Kalman1D:
    def __init__(self, process_variance=1e-5, measurement_variance=1e-3):
        # State vector: [position, velocity]
        self.x = np.array([[0.5], [0.0]]) 
        
        # Uncertainty covariance matrix
        self.P = np.eye(2)
        
        # Transition matrix (assuming constant velocity)
        # x_new = x_old + v_old * dt
        self.F = np.array([[1.0, 1.0],
                           [0.0, 1.0]])
        
        # Measurement matrix (we only measure position)
        self.H = np.array([[1.0, 0.0]])
        
        # Noise matrices
        self.Q = np.eye(2) * process_variance
        self.R = np.array([[measurement_variance]])

    def update(self, measurement):
        # 1. Predict
        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q

        # 2. Update (Correct)
        z = np.array([[measurement]])
        y = z - np.dot(self.H, self.x) # Innovation
        S = np.dot(self.H, np.dot(self.P, self.H.T)) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S)) # Kalman Gain
        
        self.x = self.x + np.dot(K, y)
        self.P = self.P - np.dot(np.dot(K, self.H), self.P)
        
        return self.x[0][0] # Return smoothed position


class KalmanFilter2D:
    def __init__(self, dt=1.0, process_noise=0.1, measurement_noise=0.01):
        # 1. State Vector [x, y, vx, vy]
        self.x = np.zeros((4, 1)) 
        
        # 2. State Covariance (Uncertainty)
        self.P = np.eye(4) * 500.0 
        
        # 3. Transition Matrix (Physics model: pos = pos + vel * dt)
        self.F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])
        
        # 4. Measurement Matrix (We only observe x and y, not velocities)
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        # 5. Measurement Noise Covariance
        self.R = np.eye(2) * measurement_noise
        
        # 6. Process Noise Covariance (How much we trust our physics model)
        self.Q = np.eye(4) * process_noise

    def update(self, z_x, z_y):
        # Measurement vector
        z = np.array([[z_x], [z_y]])

        # --- PREDICT ---
        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q

        # --- UPDATE (Correct) ---
        # S = H*P*H' + R
        S = np.dot(self.H, np.dot(self.P, self.H.T)) + self.R
        # K = P*H'*inv(S)
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))
        
        # New State = x + K*(z - H*x)
        y = z - np.dot(self.H, self.x)
        self.x = self.x + np.dot(K, y)
        
        # New Covariance = (I - K*H)*P
        I = np.eye(4)
        self.P = np.dot((I - np.dot(K, self.H)), self.P)

        # Return only the filtered [x, y]
        return self.x[0, 0], self.x[1, 0]

class HandFilterPipeline:
    def __init__(self, window_size=3):
        # Buffers for Median Filter
        self.x_buffer = deque(maxlen=window_size)
        self.y_buffer = deque(maxlen=window_size)
        
        # Kalman Filters
        self.kalman = KalmanFilter2D(process_noise=1e-4, measurement_noise=0.01)

    def filter(self, raw_x, raw_y):
        # --- Stage 1: Median Filter (Removes Spikes) ---
        # print("applying filter....")
        self.x_buffer.append(raw_x)
        self.y_buffer.append(raw_y)
        
        # Wait until buffer is full to start filtering properly
        if len(self.x_buffer) < self.x_buffer.maxlen:
            return raw_x, raw_y

        med_x = statistics.median(self.x_buffer)
        med_y = statistics.median(self.y_buffer)

        # --- Stage 2: Kalman Filter (Smooths Jitter) ---
        smooth_x, smooth_y = self.kalman.update(med_x, med_y)

        return smooth_x, smooth_y