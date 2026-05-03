import { Router } from "express"
import { PlaygroundController } from "../controllers/playground.controller"

const controller = new PlaygroundController()
const playgroundRouter = Router()

// All endpoints public — auth handled in frontend (hardcoded ANDREA/HOLGA login)
// because this is a demo playground for a single workspace (Ecolaundry)
playgroundRouter.get("/playground/usecases", (req, res) => controller.getUsecases(req, res))
playgroundRouter.get("/playground/messages", (req, res) => controller.getMessages(req, res))
playgroundRouter.get("/playground/todos", (req, res) => controller.getTodos(req, res))
playgroundRouter.post("/playground/todos", (req, res) => controller.createTodo(req, res))
playgroundRouter.patch("/playground/todos/:id", (req, res) => controller.updateTodo(req, res))
playgroundRouter.delete("/playground/todos/:id", (req, res) => controller.deleteTodo(req, res))
playgroundRouter.post("/playground/todos/:id/comments", (req, res) =>
  controller.addComment(req, res)
)

export { playgroundRouter }
