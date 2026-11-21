#!/usr/bin/env bash
# Installed on the dedicated Sahva host. A commit SHA argument pins or rolls back a release.
set -euo pipefail
umask 077
exec 9>/run/sahva-deploy.lock
flock -n 9 || exit 0
repo="Abhijit-sai/sahva"
envfile=/etc/sahva/runtime.env
app=sahva-app
previous=sahva-previous
curl_opts=(--fail --silent --show-error --location --retry 3 --proto '=https')
if [[ $# -eq 1 ]]; then
  sha="$1"
else
  release=$(curl "${curl_opts[@]}" "https://api.github.com/repos/$repo/releases/latest")
  sha=$(jq -er '.tag_name | capture("^build-(?<sha>[a-f0-9]{40})$").sha' <<<"$release")
fi
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid release ID"; exit 1; }
[[ -s "$envfile" ]] || { echo "Configure $envfile first"; exit 1; }
owned() { [[ "$(docker inspect -f '{{index .Config.Labels "io.sahva.service"}}' "$1" 2>/dev/null || true)" == "room" ]]; }
for name in "$app" "$previous"; do
  if docker container inspect "$name" >/dev/null 2>&1 && ! owned "$name"; then echo "Container name already in use"; exit 1; fi
done
healthy() { curl -fsS --max-time 5 "http://127.0.0.1:$1/api/ready" >/dev/null; }
image="sahva:$sha"
env_version=$(stat -c %Y "$envfile")
running_env=$(docker inspect -f '{{index .Config.Labels "io.sahva.env-version"}}' "$app" 2>/dev/null || true)
if [[ "$running_env" == "$env_version" && "$(docker inspect -f '{{.Config.Image}}' "$app" 2>/dev/null || true)" == "$image" ]] && healthy 3000; then exit 0; fi
stage=$(mktemp -d)
candidate=""
cleanup() {
  if [[ -n "$candidate" ]]; then docker rm -f "$candidate" >/dev/null || true; fi
  rm -f "$stage/SHA256SUMS" "$stage/sahva-linux-amd64.tar.gz"
  rmdir "$stage"
}
trap cleanup EXIT
if ! docker image inspect "$image" >/dev/null 2>&1; then
  base="https://github.com/$repo/releases/download/build-$sha"
  curl "${curl_opts[@]}" "$base/SHA256SUMS" -o "$stage/SHA256SUMS"
  curl "${curl_opts[@]}" "$base/sahva-linux-amd64.tar.gz" -o "$stage/sahva-linux-amd64.tar.gz"
  (cd "$stage" && grep -Eq '^[0-9a-f]{64}  sahva-linux-amd64.tar.gz$' SHA256SUMS && sha256sum -c SHA256SUMS)
  docker load -i "$stage/sahva-linux-amd64.tar.gz"
fi
[[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" == "$sha" ]]
docker run --rm --env-file "$envfile" "$image" node scripts/setup-supabase.ts
candidate=$(docker run -d --env-file "$envfile" -p 127.0.0.1::3000 "$image")
port=$(docker port "$candidate" 3000/tcp | cut -d: -f2)
for attempt in {1..20}; do if healthy "$port"; then break; fi; sleep 1; done
healthy "$port"
if owned "$previous"; then docker rm -f "$previous"; fi
if owned "$app"; then docker stop "$app"; docker rename "$app" "$previous"; fi
rollback() {
  if owned "$app"; then docker rm -f "$app"; fi
  if owned "$previous"; then docker rename "$previous" "$app"; docker start "$app"; fi
}
if ! docker run -d --name "$app" --label io.sahva.service=room --label "io.sahva.env-version=$env_version" --restart unless-stopped --env-file "$envfile" -p 127.0.0.1:3000:3000 "$image"; then rollback; exit 1; fi
for attempt in {1..20}; do if healthy 3000; then echo "Running release $sha"; exit 0; fi; sleep 1; done
rollback
exit 1
