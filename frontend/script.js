const API_URL = "http://localhost:3000";

async function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("status");

  if (!fileInput.files[0]) {
    status.textContent = "Please choose a file first.";
    return;
  }

  status.textContent = "Uploading...";

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  status.textContent = "Upload successful ✅";
  fileInput.value = "";
  loadFiles();
}

async function loadFiles() {
  const response = await fetch(`${API_URL}/files`);
  const files = await response.json();

  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  if (files.length === 0) {
    gallery.innerHTML = `<div class="empty">No files uploaded yet.</div>`;
    return;
  }

  files.forEach((file) => {
    const isVideo = file.name.match(/\.(mp4|mov|webm)$/i);

    gallery.innerHTML += `
      <div class="card">
        ${
          isVideo
            ? `<video src="${file.url}" controls></video>`
            : `<img src="${file.url}" alt="${file.name}" />`
        }
        <p>${file.name}</p>
        <button onclick="deleteFile('${file.name}')">Delete</button>
      </div>
    `;
  });
}

async function deleteFile(filename) {
  await fetch(`${API_URL}/delete/${filename}`, {
    method: "DELETE",
  });

  loadFiles();
}

loadFiles();