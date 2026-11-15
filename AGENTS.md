<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep color picking in a dedicated ColorPicker with colord conversions; this isolates pointer interactions and validates Hex/RGB/HSL consistently.
- Keep recent colors in drawing-session state, recording completed picks rather than every drag sample; reopening the menu preserves useful recents without storing artwork.
- Keep tool definitions in one registry and placement in a dedicated dnd-kit shelf; pointer and keyboard dragging share validated placement rules.
- Render every toolbar control through the shelf registry and enable dragging only in explicit rearrange mode; this keeps wide controls, drawer removal, and saved placement consistent.
- Persist only toolbar preferences in localStorage after hydration, tolerating blocked storage; private-browser storage is temporary and must not be treated as durable.
- Store artwork titles in exported project documents and use sanitized titles for downloads; older projects without titles remain compatible.
- Store toolbar placement as fixed slot positions and never reflow it automatically; users rely on gaps and positions staying exactly where they dropped them.
- Keep layers as a flat list of nodes pointing at their parent folder, with tree rules in layerTree; one list keeps reordering, saving and undo snapshots simple.
- Composite folders into isolated buffers and cut clipping masks to their base layer's pixels; this keeps folder opacity/blend and clipping consistent on screen, in exports and in the eyedropper.
