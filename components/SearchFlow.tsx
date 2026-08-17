// components/SearchFlow.tsx
// "Search food" from the hub. Same job as log-without-photo — build a meal by
// searching — so it's the same builder, opened straight into the search.
//
// The difference is intent: no-photo is "I ate something and forgot to snap";
// search is "I know exactly what this was". So this one opens the picker
// immediately rather than showing an empty plate first.
import React from "react";
import NoPhotoFlow from "./NoPhotoFlow";

export default function SearchFlow({
  meal, onExit, onVoice,
}: {
  meal: string;
  onExit: () => void;
  onVoice: () => void;
}) {
  return <NoPhotoFlow meal={meal} onExit={onExit} onVoice={onVoice} autoOpen searchMode />;
}