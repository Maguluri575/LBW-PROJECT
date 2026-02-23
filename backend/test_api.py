import requests

url = "https://lbw-project.onrender.com/api/analyze"

files = {
    "video": open("video1.mp4", "rb")
}

r = requests.post(url, files=files)

print(r.text)