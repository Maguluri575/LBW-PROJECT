import numpy as np

def predict_path(points):
    x = [p[0] for p in points]
    y = [p[1] for p in points]

    z = np.polyfit(x, y, 2)
    f = np.poly1d(z)

    return f
