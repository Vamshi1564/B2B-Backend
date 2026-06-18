const express = require("express");
const router = express.Router();
const db = require("../Config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Ensure folder exists
const uploadDir = "uploads/videos";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// STORAGE
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

// FILE FILTER
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
        cb(null, true);
    } else {
        cb(new Error("Only video files allowed"), false);
    }
};

// LIMIT SIZE (50MB)
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});


// ======================
// CREATE
// ======================
router.post("/", upload.single("video"), (req, res) => {
    const { title, language } = req.body;

    if (!title || !language) {
        return res.status(400).json({ message: "Title & Language required" });
    }

    const video_url = req.file
        ? `/uploads/videos/${req.file.filename}`
        : null;

    const sql = `
        INSERT INTO videos (title, language, video_url, status) 
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [title, language, video_url, 1], (err, result) => {
        if (err) return res.status(500).json(err);

        res.json({
            message: "Video uploaded successfully",
            id: result.insertId,
        });
    });
});


router.get("/active/:language", (req, res) => {
    const { language } = req.params;

    const sql = `
      SELECT * FROM videos 
      WHERE status = 1 AND language = ?
      ORDER BY id DESC
    `;

    db.query(sql, [language], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result); // ✅ return ALL videos
    });
});

// ✅ ONLY ACTIVE VIDEO FOR FRONTEND
router.get("/active", (req, res) => {
    const sql = `
      SELECT * FROM videos 
      WHERE status = 1 
      ORDER BY id DESC 
      LIMIT 1
    `;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result[0] || null);
    });
});

// ======================
// GET ALL VIDEOS
// ======================
router.get("/", (req, res) => {
    const sql = "SELECT * FROM videos ORDER BY id DESC";

    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});


// ======================
// DELETE (with file remove)
// ======================
router.delete("/:id", (req, res) => {
    // get video path first
    db.query("SELECT video_url FROM videos WHERE id=?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);

        const videoPath = result[0]?.video_url;

        // delete DB record
        db.query("DELETE FROM videos WHERE id=?", [req.params.id], (err2) => {
            if (err2) return res.status(500).json(err2);

            // delete file
            if (videoPath) {
                const fullPath = path.join(__dirname, "..", videoPath);
                fs.unlink(fullPath, (err) => {
                    if (err) console.log("File delete error:", err);
                });
            }

            res.json({ message: "Deleted successfully" });
        });
    });
});


// ======================
// TOGGLE STATUS
// ======================
router.patch("/:id/status", (req, res) => {
    const { status } = req.body;
    const id = req.params.id;

    db.query(
        "UPDATE videos SET status=? WHERE id=?",
        [status, id],
        (err) => {
            if (err) return res.status(500).json(err);

            res.json({
                message:
                    status === 1
                        ? "Video activated ✅"
                        : "Video deactivated ❌",
            });
        }
    );
});


// ======================
// UPDATE
// ======================
router.put("/:id", upload.single("video"), (req, res) => {
    const { title, language } = req.body;


    const video_url = req.file
        ? `/uploads/videos/${req.file.filename}`
        : null;

    let sql;
    let params;

    if (video_url) {
        sql = "UPDATE videos SET title=?, language=?, video_url=? WHERE id=?";
        params = [title, language, video_url, req.params.id];
    } else {
        sql = "UPDATE videos SET title=?, language=? WHERE id=?";
        params = [title, language, req.params.id];
    }

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Updated successfully" });
    });
});

module.exports = router;