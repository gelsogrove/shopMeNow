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
import { ClipboardList, MessageSquare } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { PageLayout } from "@/components/layout/PageLayout"
import { KanbanBoard, type KanbanOps } from "@/components/kanban/KanbanBoard"
import { Button } from "@/components/ui/button"
import { kanbanApi } from "@/services/playgroundKanbanApi"

const ops: KanbanOps = {
  list: () => kanbanApi.list(),
  update: (id, patch) => kanbanApi.update(id, patch),
  remove: (id) => kanbanApi.remove(id),
  comment: (todoId, text) => kanbanApi.comment(todoId, text),
  removeComment: (todoId, commentId) => kanbanApi.removeComment(todoId, commentId),
}

export default function FeedbackBoardPage() {
  const navigate = useNavigate()

  return (
    <PageLayout>
      {/* Full viewport height minus the app chrome, so the columns are tall
          enough to work in: a card list that stops a third of the way down the
          page makes dragging between columns needlessly fiddly. */}
      <div className="flex h-[calc(100vh-11rem)] flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          {/* Back to where the cards come from — the round trip is frequent. */}
          <Button variant="outline" onClick={() => navigate("/chat")}>
            <MessageSquare className="mr-2 h-4 w-4 text-green-600" />
            Chat History
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          <KanbanBoard ops={ops} socketOrigin={window.location.origin} />
        </div>
      </div>
    </PageLayout>
  )
}
