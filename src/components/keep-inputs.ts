"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React setzt ein Formular nach jeder Server Action auf die Anfangswerte zurück – auch wenn die
 * Action nur einen Eingabefehler meldet. Über onSubmit abgeschickt bleiben die Eingaben stehen;
 * ohne JavaScript greift weiterhin das action-Attribut.
 */
export function keepInputs(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
