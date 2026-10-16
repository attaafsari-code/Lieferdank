import React, { useMemo } from "react";
import { parse, SvgAst } from "react-native-svg";
import { decodeSvgText } from "./card-editor";

/** Render the canonical artwork. react-native-svg's XML parser leaves text entities encoded. */
export function CardArtwork({ xml }: { xml: string }) {
  const ast = useMemo(() => parse(xml, decodeSvgText), [xml]);
  return <SvgAst ast={ast} override={{ width: "100%", height: "100%", viewBox: "0 0 85.6 54" }} />;
}
