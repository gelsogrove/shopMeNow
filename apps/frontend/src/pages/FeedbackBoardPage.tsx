/**
 * FeedbackBoardPage — the in-app door onto the feedback board.
 *
 * Same board as the public /demo/<slug>/kanban page, one per workspace. Here
 * the team works the cards: whatever a client reported while trying the bot
 * lands in "To do", and gets moved through to "Done".
 *
 * Identity comes from the JWT: the shared axios client attaches the token and
 * the workspace header, and the backend files anything written here as STAFF.
 */
import { ClipboardList } from "lucide-react"

import { PageLayout } from "@/components/layout/PageLayout"
import { KanbanBoard, type KanbanOps } from "@/components/kanban/KanbanBoard"
import { kanbanApi } from "@/services/playgroundKanbanApi"

const ops: KanbanOps = {
  list: () => kanbanApi.list(),
  update: (id, patch) => kanbanApi.update(id, patch),
  remove: (id) => kanbanApi.remove(id),
  comment: (todoId, text) => kanbanApi.comment(todoId, text),
  removeComment: (todoId, commentId) => kanbanApi.removeComment(todoId, commentId),
}

export default function FeedbackBoardPage() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
            <ClipboardList className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feedback Board</h1>
            <p className="text-sm text-gray-500">
              Issues reported from chat conversations, yours and your customers'
            </p>
          </div>
        </div>

        <KanbanBoard ops={ops} socketOrigin={window.location.origin} />
      </div>
    </PageLayout>
  )
}
