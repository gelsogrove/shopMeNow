/**
 * Playground Kanban — identity boundary unit tests.
 *
 * WHAT THIS PINS
 * The kanban lives on a PUBLIC route (/demo/<slug>/kanban) with one board per
 * Flow workspace. There is no JWT, so the only thing separating one client's
 * board from another's is that the handlers derive the workspace and the author
 * from the playground sessionId — never from the request.
 *
 * WHY IT MATTERS
 * Cards hold a client's criticism of their own bot. If `x-workspace-id` were
 * trusted, a visitor holding the demorobot link could read demowash's board; if
 * `createdBy` were trusted, they could sign a card as someone else and delete
 * that person's comments. Both are silent leaks — no error, just the wrong data
 * on screen — so they are locked here rather than left to review.
 *
 * These tests are about the AUTHORIZATION boundary only. They deliberately do
 * not assert on card contents or ordering.
 */

import { Request, Response } from "express"

// The controller imports a ready-made prisma client, so the module is mocked
// rather than injected. Only the models the kanban handlers touch are defined.
jest.mock("@echatbot/database", () => ({
  prisma: {
    chatSession: { findFirst: jest.fn() },
    playgroundTodo: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    playgroundComment: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    workspace: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}))
jest.mock("../../../src/utils/logger")

import { prisma } from "@echatbot/database"
import { PlaygroundController } from "../../../src/interfaces/http/controllers/playground.controller"

const mockPrisma = prisma as unknown as {
  chatSession: { findFirst: jest.Mock }
  playgroundTodo: {
    findMany: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  playgroundComment: { create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock }
}

/** A playground session belonging to demowash, owned by a customer named Olga. */
const DEMOWASH_SESSION = {
  workspaceId: "ws-demowash",
  customer: { name: "Olga" },
}

function buildResponse() {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res as Response & {
    status: jest.Mock
    json: jest.Mock
    send: jest.Mock
  }
}

function buildRequest(overrides: Partial<Request> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    app: { get: jest.fn().mockReturnValue(null) }, // no socket.io in tests
    ...overrides,
  } as unknown as Request
}

describe("PlaygroundController — kanban identity boundary", () => {
  let controller: PlaygroundController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new PlaygroundController()
  })

  describe("a request without a valid session is rejected", () => {
    // Every kanban handler must refuse before touching the board. Listed as a
    // table so a newly added handler that forgets the check is visible here.
    const callers: Array<[string, (c: PlaygroundController, res: Response) => Promise<unknown>]> = [
      ["getTodos", (c, res) => c.getTodos(buildRequest(), res)],
      [
        "createTodo",
        (c, res) =>
          c.createTodo(
            buildRequest({
              body: {
                dialogId: "msg-1",
                messageType: "chatbot",
                messageContent: "hello",
                commentTitle: "wrong answer",
              },
            } as Partial<Request>),
            res
          ),
      ],
      [
        "updateTodo",
        (c, res) =>
          c.updateTodo(
            buildRequest({ params: { id: "todo-1" }, body: { status: "DONE" } } as Partial<Request>),
            res
          ),
      ],
      [
        "deleteTodo",
        (c, res) => c.deleteTodo(buildRequest({ params: { id: "todo-1" } } as Partial<Request>), res),
      ],
      [
        "addComment",
        (c, res) =>
          c.addComment(
            buildRequest({ params: { id: "todo-1" }, body: { commentText: "hi" } } as Partial<Request>),
            res
          ),
      ],
      [
        "deleteComment",
        (c, res) =>
          c.deleteComment(
            buildRequest({
              params: { todoId: "todo-1", commentId: "c-1" },
            } as Partial<Request>),
            res
          ),
      ],
    ]

    it.each(callers)("%s returns 401 when no sessionId is supplied", async (_name, call) => {
      const res = buildResponse()

      await call(controller, res)

      expect(res.status).toHaveBeenCalledWith(401)
      // The board must not be read or written on an unauthenticated call.
      expect(mockPrisma.playgroundTodo.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.playgroundTodo.create).not.toHaveBeenCalled()
      expect(mockPrisma.playgroundTodo.update).not.toHaveBeenCalled()
      expect(mockPrisma.playgroundTodo.delete).not.toHaveBeenCalled()
    })

    it("a sessionId that matches no playground session is rejected", async () => {
      // An unguessable-but-wrong id must fail closed, exactly like a missing one.
      mockPrisma.chatSession.findFirst.mockResolvedValue(null)
      const res = buildResponse()

      await controller.getTodos(
        buildRequest({ query: { sessionId: "does-not-exist" } } as Partial<Request>),
        res
      )

      expect(res.status).toHaveBeenCalledWith(401)
      expect(mockPrisma.playgroundTodo.findMany).not.toHaveBeenCalled()
    })

    it("a session whose customer has no name is rejected", async () => {
      // createdBy would otherwise be empty, leaving cards unattributable.
      mockPrisma.chatSession.findFirst.mockResolvedValue({
        workspaceId: "ws-demowash",
        customer: null,
      })
      const res = buildResponse()

      await controller.getTodos(
        buildRequest({ query: { sessionId: "sess-1" } } as Partial<Request>),
        res
      )

      expect(res.status).toHaveBeenCalledWith(401)
    })
  })

  describe("the workspace comes from the session, not from the request", () => {
    it("getTodos reads the session's board even when a foreign workspace header is sent", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundTodo.findMany.mockResolvedValue([])
      const res = buildResponse()

      await controller.getTodos(
        buildRequest({
          query: { sessionId: "sess-1" },
          // A visitor trying to read another client's board.
          headers: { "x-workspace-id": "ws-demorobot" },
        } as Partial<Request>),
        res
      )

      expect(mockPrisma.playgroundTodo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: "ws-demowash" } })
      )
    })

    it("only playground sessions can unlock a board", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundTodo.findMany.mockResolvedValue([])

      await controller.getTodos(
        buildRequest({ query: { sessionId: "sess-1" } } as Partial<Request>),
        buildResponse()
      )

      // A real WhatsApp session must never be usable as a kanban credential.
      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPlayground: true }),
        })
      )
    })
  })

  describe("the author comes from the session, not from the request", () => {
    it("createTodo ignores a createdBy sent in the body", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundTodo.findFirst.mockResolvedValue(null)
      mockPrisma.playgroundTodo.create.mockResolvedValue({ id: "todo-1", comments: [] })
      const res = buildResponse()

      await controller.createTodo(
        buildRequest({
          body: {
            sessionId: "sess-1",
            dialogId: "msg-1",
            messageType: "chatbot",
            messageContent: "what are your prices?",
            chatbotResponse: "I don't know",
            commentTitle: "bot cannot answer pricing",
            // Impersonation attempt — must be discarded.
            createdBy: "ANDREA",
          },
        } as Partial<Request>),
        res
      )

      expect(mockPrisma.playgroundTodo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: "Olga",
            workspaceId: "ws-demowash",
          }),
        })
      )
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it("addComment signs the comment with the session's name", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundTodo.findFirst.mockResolvedValue({ id: "todo-1" })
      mockPrisma.playgroundComment.create.mockResolvedValue({ id: "c-1" })
      mockPrisma.playgroundTodo.update.mockResolvedValue({ id: "todo-1" })

      await controller.addComment(
        buildRequest({
          params: { id: "todo-1" },
          body: { sessionId: "sess-1", commentText: "still broken", createdBy: "ANDREA" },
        } as Partial<Request>),
        buildResponse()
      )

      expect(mockPrisma.playgroundComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdBy: "Olga" }),
        })
      )
    })

    it("deleteComment refuses to delete another author's comment", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundComment.findUnique.mockResolvedValue({
        id: "c-1",
        todoId: "todo-1",
        createdBy: "Andrea", // written by someone else
        todo: { workspaceId: "ws-demowash" },
      })
      const res = buildResponse()

      await controller.deleteComment(
        buildRequest({
          params: { todoId: "todo-1", commentId: "c-1" },
          query: { sessionId: "sess-1" },
        } as Partial<Request>),
        res
      )

      expect(res.status).toHaveBeenCalledWith(403)
      expect(mockPrisma.playgroundComment.delete).not.toHaveBeenCalled()
    })
  })

  describe("cards from another workspace are invisible", () => {
    it("updateTodo 404s when the card is not on the session's board", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      // Scoped lookup finds nothing: the card belongs to a different workspace.
      mockPrisma.playgroundTodo.findFirst.mockResolvedValue(null)
      const res = buildResponse()

      await controller.updateTodo(
        buildRequest({
          params: { id: "todo-of-another-client" },
          body: { sessionId: "sess-1", status: "DONE" },
        } as Partial<Request>),
        res
      )

      expect(res.status).toHaveBeenCalledWith(404)
      expect(mockPrisma.playgroundTodo.update).not.toHaveBeenCalled()
      expect(mockPrisma.playgroundTodo.findFirst).toHaveBeenCalledWith({
        where: { id: "todo-of-another-client", workspaceId: "ws-demowash" },
      })
    })
  })

  describe("priority labels are the English set", () => {
    it("rejects the retired Italian labels", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      const res = buildResponse()

      await controller.createTodo(
        buildRequest({
          body: {
            sessionId: "sess-1",
            dialogId: "msg-1",
            messageType: "chatbot",
            messageContent: "hello",
            commentTitle: "title",
            priority: "Alto",
          },
        } as Partial<Request>),
        res
      )

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mockPrisma.playgroundTodo.create).not.toHaveBeenCalled()
    })

    it("defaults to MEDIUM when no priority is given", async () => {
      mockPrisma.chatSession.findFirst.mockResolvedValue(DEMOWASH_SESSION)
      mockPrisma.playgroundTodo.findFirst.mockResolvedValue(null)
      mockPrisma.playgroundTodo.create.mockResolvedValue({ id: "todo-1", comments: [] })

      await controller.createTodo(
        buildRequest({
          body: {
            sessionId: "sess-1",
            dialogId: "msg-1",
            messageType: "chatbot",
            messageContent: "hello",
            commentTitle: "title",
          },
        } as Partial<Request>),
        buildResponse()
      )

      expect(mockPrisma.playgroundTodo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: "MEDIUM" }),
        })
      )
    })
  })

  describe("no customer-facing copy in the source (CLAUDE.md §1A)", () => {
    it("the 409 on a chat with cards carries a code, not a sentence", async () => {
      // The wording belongs to the UI, which can translate it. A hardcoded
      // English sentence here would reach an Italian-speaking client untranslated.
      const source = require("fs").readFileSync(
        require("path").resolve(
          __dirname,
          "../../../src/interfaces/http/controllers/playground.controller.ts"
        ),
        "utf-8"
      )
      expect(source).toContain("CHAT_HAS_TODOS")
      expect(source).not.toContain("This chat has TODO cards on the kanban")
    })

    it("no tenant-specific reviewer names are hardcoded", async () => {
      const source = require("fs").readFileSync(
        require("path").resolve(
          __dirname,
          "../../../src/interfaces/http/controllers/playground.controller.ts"
        ),
        "utf-8"
      )
      expect(source).not.toContain("ALLOWED_USERS")
      expect(source).not.toMatch(/"OLGA"/)
    })
  })
})
