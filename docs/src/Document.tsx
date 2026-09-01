import { HydrationScript } from "@solidjs/web";
import type { ParentProps } from "solid-js";

export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
        <script innerHTML="(function(){try{var c=localStorage.getItem(`__theme`);document.documentElement.style.colorScheme=c===`light`||c===`dark`?c:`light dark`}catch(e){}})();" />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
