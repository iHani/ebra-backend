// src/api/mock-provider.ts
import { Router } from "express";
import axios from "axios";

const router = Router();


router.post("/", async (req, res) => {
    const { to, scriptId, webhookUrl } = req.body;

    console.log(`[Mock AI] Call initiated for ${to} (${scriptId})`);

    setTimeout(async () => {
        const isSuccess = Math.random() > 0.3;
        const payload = {
            callId: req.body.callId,
            status: isSuccess ? "COMPLETED" : "FAILED",
            message: isSuccess ? "Call finished successfully" : "AI voice failed",
        };

        console.log(`[Mock AI] Sending callback:`, payload);

        await axios.post(webhookUrl, payload).catch(err => {
            console.error(`Callback failed:`, err.message);
        });
    }, 2000);

    res.status(202).json({ message: "Call accepted by mock AI" });
});

export default router;