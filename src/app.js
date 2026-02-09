import express from 'express';
import cors from "cors";
import morgan from 'morgan';
import swaggerUi from "swagger-ui-express";
import cookieParser from 'cookie-parser';
import swaggerSpec from "./docs/swagger.js";
import { connectDB } from "./db/db.connection.js";
import authRoutes from "./modules/auth/auth.controller.js";
import userRoutes from "./modules/users/user.controller.js";
import projectRoutes from "./modules/projects/project.controller.js";
import dashboardRoutes from "./modules/dashboard/dashboard.controller.js";
import materialRoutes from "./modules/metrial/metrials.controllers.js";
import procurementRoutes from "./modules/procurement/procurement.controller.js";
import { globalErrorHandler } from "./middlewares/error.js";
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const corsOptions = {
  origin: '*', // Allow all origins or specify your frontend URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Required for cookies/sessions
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(cookieParser());
const port = process.env.PORT
export const bootstrap = async () => {
  app.get('/', (req, res) => {
    res.send('API is working!');
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/procurement', procurementRoutes);
  app.use(globalErrorHandler);

  await connectDB();


  app.use(express.json());
  app.use((req, res, next) => {
    req.socket.on('error', (err) => {
      console.error('Request socket error:', err);
    });
    next();
  });
  return app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
  });
};

