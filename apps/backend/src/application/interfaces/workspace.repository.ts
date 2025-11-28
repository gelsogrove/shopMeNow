import { Workspace } from "../../domain/entities/workspace.entity"
import { UpdateWorkspaceDTO } from "../dtos/workspace.dto"

export interface IWorkspaceRepository {
  create(workspace: Workspace): Promise<Workspace>
  findById(id: string): Promise<Workspace | null>
  findBySlug(slug: string): Promise<Workspace | null>
  findAll(): Promise<Workspace[]>
  update(id: string, data: UpdateWorkspaceDTO): Promise<Workspace>
  delete(id: string): Promise<void>
}
