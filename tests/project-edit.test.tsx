import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import EditProjectModal from "../src/Component_master/components/EditProjectModal";
import ProjectTable from "../src/Component_master/components/ProjectTable";
import ProjectCardMobile from "../src/Component_master/components/ProjectCardMobile";

vi.mock("../src/app.js", () => ({ BASEURL: "https://example.test/api/", TOKEN: () => "test-token" }));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));
vi.mock("axios", () => ({ default: { put: vi.fn(), isAxiosError: (error: { isAxiosError?: boolean }) => Boolean(error?.isAxiosError) } }));

const project = { guid: "project-guid", id: 9, projectid: "PSE20251024", projectname: "Original project", entity_id: 1, entity: { id: 1, entityname: "Proscape LLC" }, isactive: true };
const entities = [{ id: 1, entityname: "Proscape LLC" }, { id: 2, entityname: "Water in Motion" }];
const callbacks = () => ({ onView: vi.fn(), onDelete: vi.fn(), onAssignLocation: vi.fn(), onEdit: vi.fn() });

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("project edit", () => {
  it("offers edit from desktop and mobile views and opens the selected project", async () => {
    const actions = callbacks();
    const desktop = render(<ProjectTable projects={[project]} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit project PSE20251024" }));
    expect(actions.onEdit).toHaveBeenCalledWith(project);
    desktop.unmount();
    render(<ProjectCardMobile project={{ ...project, entity: null }} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit project PSE20251024" }));
    expect(actions.onEdit).toHaveBeenCalledTimes(2);
    expect(screen.getByText("No Entity")).toBeTruthy();
  });

  it("prefills values, saves via the GUID endpoint, preserves unrelated fields and refreshes", async () => {
    vi.mocked(axios.put).mockResolvedValue({ data: { success: true } });
    const onSaved = vi.fn(), onClose = vi.fn();
    render(<EditProjectModal project={project} entities={entities} isOpen onSaved={onSaved} onClose={onClose} />);
    expect((screen.getByLabelText("Project ID") as HTMLInputElement).readOnly).toBe(true);
    const name = screen.getByLabelText("Project Name");
    expect((name as HTMLInputElement).value).toBe("Original project");
    await userEvent.clear(name);
    await userEvent.type(name, "  Updated project  ");
    await userEvent.selectOptions(screen.getByLabelText("Entity"), "2");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "inactive");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(axios.put).toHaveBeenCalledWith("https://example.test/api/v2/projects/project-guid", { projectname: "Updated project", entity_id: "2", active: false }, { headers: { Authorization: "Bearer test-token" } });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("rejects whitespace-only names without calling the API", async () => {
    render(<EditProjectModal project={project} entities={entities} isOpen onSaved={vi.fn()} onClose={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText("Project Name"));
    await userEvent.type(screen.getByLabelText("Project Name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a project name");
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("keeps unsaved changes and displays validation errors so the user can retry", async () => {
    vi.mocked(axios.put).mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: "Validation failed", errors: { entity_id: ["Entity not found."] } } } }).mockResolvedValueOnce({ data: { success: true } });
    const onSaved = vi.fn(), onClose = vi.fn();
    render(<EditProjectModal project={project} entities={entities} isOpen onSaved={onSaved} onClose={onClose} />);
    await userEvent.clear(screen.getByLabelText("Project Name"));
    await userEvent.type(screen.getByLabelText("Project Name"), "Retry project");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Entity not found."));
    expect((screen.getByLabelText("Project Name") as HTMLInputElement).value).toBe("Retry project");
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("blocks duplicate submissions and prevents closing while a save is pending", async () => {
    let resolve!: (value: { data: { success: boolean } }) => void;
    vi.mocked(axios.put).mockReturnValue(new Promise(done => { resolve = done; }));
    const onClose = vi.fn();
    render(<EditProjectModal project={project} entities={entities} isOpen onSaved={vi.fn()} onClose={onClose} />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Save Changes" }));
    expect(axios.put).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    resolve({ data: { success: true } });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("resets the form when another project is selected and cancels without saving", async () => {
    const onClose = vi.fn();
    const props = { entities, isOpen: true, onSaved: vi.fn(), onClose };
    const view = render(<EditProjectModal project={project} {...props} />);
    await userEvent.type(screen.getByLabelText("Project Name"), " unsaved");
    view.rerender(<EditProjectModal project={{ ...project, guid: "another-guid", projectname: "Another project", entity_id: null, entity: null, isactive: false }} {...props} />);
    expect((screen.getByLabelText("Project Name") as HTMLInputElement).value).toBe("Another project");
    expect((screen.getByLabelText("Entity") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("inactive");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(axios.put).not.toHaveBeenCalled();
  });
});
