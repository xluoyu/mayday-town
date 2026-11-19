export const dialog = document.querySelector<HTMLDialogElement>('#modal')!;
let previousFocus: HTMLElement | null = null;

export function showDialog(title: string, description: string, body: string, icon = '✦') {
  if (dialog.open) return;
  previousFocus = document.activeElement as HTMLElement;
  document.querySelector('#modal-title')!.textContent = title;
  document.querySelector('#modal-description')!.textContent = description;
  document.querySelector('#modal-body')!.textContent = body;
  document.querySelector('#modal-icon')!.textContent = icon;
  dialog.showModal();
}

for (const id of ['close', 'return']) document.getElementById(id)!.onclick = () => dialog.close();
dialog.addEventListener('close', () => previousFocus?.focus());
