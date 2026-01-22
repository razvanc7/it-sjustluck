import express from "express";
import cors from "cors";
import authRoutes from "./auth";
import locationRoutes from "./location";
import profileRoutes from "./profile"; 
import friendsRoutes from "./friends"; 
import leaderboardRoutes from "./leaderboard";
import chatRoutes from "./chat"; // <--- Import
import notificationRoutes from "./notifications";
import achievementsRoutes from "./achievements";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/friends", friendsRoutes);
app.use("/profile", profileRoutes);
app.use("/location", locationRoutes); 
app.use("/leaderboard", leaderboardRoutes);
app.use("/chat", chatRoutes); // <--- Use
app.use("/notifications", notificationRoutes);
app.use("/achievements", achievementsRoutes);

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on:");
  console.log("- Local: http://localhost:3000");
  console.log("- Android Emulator: http://10.0.2.2:3000");
});