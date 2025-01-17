import { isObject } from "@chakra-ui/utils/is"
import { mergeWith } from "@chakra-ui/utils/merge"
import { pseudoSelectors } from "../pseudos"
import { calc, Operand } from "./calc"
import { cssVar } from "./css-var"
import { FlatToken, FlatTokens } from "./flatten-tokens"

export interface CreateThemeVarsOptions {
  cssVarPrefix?: string
}

export interface ThemeVars {
  cssVars: Record<string, any>
  cssMap: Record<string, any>
}

/**
 * Convert a token name to a css variable
 *
 * @example
 * tokenToCssVar('colors.red.500', 'chakra')
 * => {
 *   variable: '--chakra-colors-red-500',
 *   reference: 'var(--chakra-colors-red-500)'
 * }
 */
function tokenToCssVar(token: string | number, prefix?: string) {
  return cssVar(String(token).replace(/\./g, "-"), undefined, prefix)
}

export function createThemeVars(
  flatTokens: FlatTokens,
  options: CreateThemeVarsOptions,
) {
  let cssVars: Record<string, any> = {}
  const cssMap: Record<string, any> = {}

  for (const [token, tokenValue] of Object.entries<FlatToken>(flatTokens)) {
    const { isSemantic, value } = tokenValue
    const { variable, reference } = tokenToCssVar(token, options?.cssVarPrefix)

    if (!isSemantic) {
      if (token.startsWith("space")) {
        const keys = token.split(".")
        const [firstKey, ...referenceKeys] = keys

        /** @example space.-4 */
        const negativeLookupKey = `${firstKey}.-${referenceKeys.join(".")}`
        const negativeValue = calc.negate(value as Operand)
        const negatedReference = calc.negate(reference)

        cssMap[negativeLookupKey] = {
          value: negativeValue,
          var: variable,
          varRef: negatedReference,
        }
      }

      cssVars[variable] = value
      cssMap[token] = {
        value,
        var: variable,
        varRef: reference,
      }
      continue
    }

    const lookupToken = (maybeToken: string) => {
      const scale = String(token).split(".")[0]
      const withScale = [scale, maybeToken].join(".")

      /** @example flatTokens['space.4'] === '16px' */
      const resolvedTokenValue = flatTokens[withScale]
      if (!resolvedTokenValue) return maybeToken

      const { reference } = tokenToCssVar(withScale, options?.cssVarPrefix)
      return reference
    }

    const normalizedValue = isObject(value) ? value : { default: value }

    cssVars = mergeWith(
      cssVars,
      Object.entries(normalizedValue).reduce(
        (acc, [conditionAlias, conditionValue]) => {
          if (!conditionValue) return acc
          const tokenReference = lookupToken(`${conditionValue}`)

          if (conditionAlias === "default") {
            acc[variable] = tokenReference
            return acc
          }

          /** @example { _dark: "#fff" } => { '.chakra-ui-dark': "#fff" } */
          const conditionSelector =
            (pseudoSelectors as any)?.[conditionAlias] ?? conditionAlias

          acc[conditionSelector] = { [variable]: tokenReference }

          return acc
        },
        {} as any,
      ),
    )

    cssMap[token] = {
      value: reference,
      var: variable,
      varRef: reference,
    }
  }

  return {
    cssVars,
    cssMap,
  }
}
