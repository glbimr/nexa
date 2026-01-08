# Mobile Screen Share Modal Update

## Feature
Replaced the native browser `alert()` for mobile screen sharing attempts with a custom, styled Dialog Modal.

## Implementation Details
1.  **Iconography**: Uses the `Smartphone` icon from `lucide-react` to clearly indicate the context.
2.  **Design**: Matches the app's existing "Delete User" dialog aesthetic:
    -   Centered circular icon background (Blue for information/notice).
    -   Clean, centered typography.
    -   Premium "Got it" action button with hover effects and shadow.
3.  **Component**: Integrated into `Communication.tsx` using the shared `Modal` component.

## Behavior
-   When a user on a mobile device (Android, iOS, etc.) clicks the "Screen Share" button:
    -   Instead of a generic system alert, they now see a smooth modal appearing overlay.
    -   The modal informs them: "Screen sharing is **coming soon** for mobile devices."
    -   Clicking "Got it" closes the modal.
-   Desktop users continue to trigger the actual screen sharing logic.

## Verification
-   Build verified via `npm run build`.
-   Code follows the existing UI patterns found in `AdminPanel.tsx`.
