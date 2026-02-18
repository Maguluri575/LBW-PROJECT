import mediapipe as mp

mp_pose = mp.solutions.pose

def detect_leg_position(frame):
    with mp_pose.Pose() as pose:
        result = pose.process(frame)

        if result.pose_landmarks:
            knee = result.pose_landmarks.landmark[25]
            return knee.x, knee.y

    return None
