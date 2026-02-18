import React, { useState } from "react";

export default function Upload() {

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async () => {

    if (!file) {
      setError("Please select a video first");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("video", file);

      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      setResult(data.result);
      setConfidence(data.confidence);

    } catch (err) {
      setError("Failed to analyze video. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">

      <h2 className="text-xl font-bold mb-4">
        Upload Cricket Video
      </h2>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="mb-4"
      />

      <br />

      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Analyze Video
      </button>

      {loading && (
        <p className="mt-4">Analyzing... please wait</p>
      )}

      {error && (
        <p className="text-red-500 mt-4">{error}</p>
      )}

      {result && (
        <div className="mt-6 p-4 border rounded">
          <h3 className="text-lg font-bold">Result: {result}</h3>

          {confidence && (
            <p>Confidence: {(confidence * 100).toFixed(2)}%</p>
          )}
        </div>
      )}

    </div>
  );
}
