import { Indexed } from "ethers";

export function eventArgsToObject({ fragment, args }) {
  return Object.fromEntries(
    fragment.inputs.map((input, index) => {
      const value = args[index];
      return [
        input.name,
        Indexed.isIndexed(value) ? value.hash : String(value),
      ];
    }),
  );
}
