require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// 🔐 PASTE YOUR CONNECTION STRING HERE
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "media";

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
const cosmosKey = process.env.COSMOS_KEY;

const cosmosClient = new CosmosClient({
    endpoint: cosmosEndpoint,
    key: cosmosKey
});

const database = cosmosClient.database("cloudsnapdb");
const metadataContainer = database.container("files");

// 📤 Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const blobName = Date.now() + "-" + file.originalname;

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(file.buffer);

        const url = blockBlobClient.url;
        const metadata = {
    id: blobName,
    name: blobName,
    url: url,
    type: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString()
};

await metadataContainer.items.create(metadata);

        res.json({ message: "Upload successful", url });
    } catch (error) {
        console.error(error);
        res.status(500).send("Upload failed");
    }
});
// 📂 Get all uploaded files
app.get("/files", async (req, res) => {
    try {
        const files = [];

        for await (const blob of containerClient.listBlobsFlat()) {
            files.push({
                name: blob.name,
                url: `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net/media/${blob.name}`
            });
        }

        res.json(files);

    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to fetch files");
    }
});
// ❌ Delete file
// ❌ Delete file + metadata
// Delete file from Blob Storage + metadata from Cosmos DB
app.delete("/delete/:filename", async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);

        console.log("Filename received:", filename);

        // 1. Delete file from Azure Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        await blockBlobClient.deleteIfExists();

        // 2. Find matching metadata document in Cosmos DB
        const querySpec = {
            query: "SELECT * FROM c WHERE c.name = @name OR c.id = @id",
            parameters: [
                { name: "@name", value: filename },
                { name: "@id", value: filename }
            ]
        };

        const { resources } = await metadataContainer.items
            .query(querySpec)
            .fetchAll();

        console.log("Metadata records found:", resources.length);

        // 3. Delete every matching metadata record
        for (const item of resources) {
            console.log("Deleting metadata:", item.id, item.type);

            await metadataContainer
                .item(item.id, item.type)
                .delete();
        }

        res.json({
            message: "File and metadata deleted successfully",
            deletedMetadataCount: resources.length
        });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({
            message: "Delete failed",
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
