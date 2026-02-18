import requests

url = "http://localhost:5000/analyze"

files = {
    "video": open("video1.mp4", "rb")
}

r = requests.post(url, files=files)

print(r.text)
