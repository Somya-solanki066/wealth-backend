import express from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = express.Router();

router.get("/:pageId", async (req, res) => {
  try {
    const db = getFirestore();
    const { pageId } = req.params;
    const docRef = db.collection("page_content").doc(pageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Return empty object if it doesn't exist yet so frontend doesn't crash
      return res.json({ data: {} });
    }

    res.json({ data: doc.data() });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/:pageId", async (req, res) => {
  try {
    const db = getFirestore();
    const { pageId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== "object") {
      return res.status(400).json({ error: "Invalid content payload." });
    }

    const docRef = db.collection("page_content").doc(pageId);
    await docRef.set(content, { merge: true });

    res.json({ message: "Content updated successfully." });
  } catch (error) {
    console.error("Error updating content:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
