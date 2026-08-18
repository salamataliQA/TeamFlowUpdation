import { store } from "../store.js";
import { AuditService } from "./AuditService.js";

export { AuditService };

export const UserService = {
  list: () => store.listUsers(),
  update: (id, data) => store.updateUser(id, data),
  add: (id, data) => store.addUser(id, data),
};
