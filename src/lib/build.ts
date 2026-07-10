import {
  BUILD_COMMIT as STATIC_BUILD_COMMIT,
  BUILD_DEPLOY_NUMBER as STATIC_BUILD_DEPLOY_NUMBER,
  BUILD_VERSION_NUMBER,
} from "../../build-info.ts"

declare const __BUILD_COMMIT__: string

const runtimeBuildCommit =
  typeof __BUILD_COMMIT__ !== "undefined" && __BUILD_COMMIT__.trim().length > 0
    ? __BUILD_COMMIT__.trim()
    : ""

export const BUILD_COMMIT = runtimeBuildCommit || STATIC_BUILD_COMMIT
export const BUILD_DEPLOY_NUMBER = STATIC_BUILD_DEPLOY_NUMBER
export const BUILD_LABEL = `${BUILD_VERSION_NUMBER}-${BUILD_DEPLOY_NUMBER}-${BUILD_COMMIT}`
export const BUILD_VERSION = BUILD_LABEL

export { BUILD_VERSION_NUMBER }
