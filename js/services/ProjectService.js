import { AUDIT_ACTIONS } from "../constants.js";
import { getCurrentUser, logAudit } from "../auth.js";
import { assertCan } from "../permissions.js";
import { store } from "../store.js";
import { throwIfInvalid, validateProjectPayload } from "../validation.js";

export const ProjectService = {
  async create(data) {
    assertCan("createProject");
    const projects = store.snapshot()?.projects || [];
    throwIfInvalid(validateProjectPayload(data, projects));
    const created = await store.addProject({
      ...data,
      createdBy: getCurrentUser().id,
    });
    await logAudit(AUDIT_ACTIONS.CREATE_PROJECT, {
      projectId: created.id,
      projectName: created.name,
      newValue: { status: created.status },
    });
    return created;
  },
  async update(project, data) {
    if (data.status === "archived") assertCan("archiveProject");
    else assertCan("editProject");
    const projects = store.snapshot()?.projects || [];
    throwIfInvalid(validateProjectPayload({ ...project, ...data }, projects, project.id));
    await store.updateProject(project.id, data);
    await logAudit(data.status === "archived" ? AUDIT_ACTIONS.ARCHIVE_PROJECT : AUDIT_ACTIONS.UPDATE_PROJECT, {
      projectId: project.id,
      projectName: data.name || project.name,
      oldValue: { status: project.status, name: project.name },
      newValue: data,
    });
  },
};
