# [1.1.0](https://github.com/ludeo-labs/core-integration-skill/compare/v1.0.0...v1.1.0) (2026-05-31)


### Bug Fixes

* **actions:** correct ludeo_DataWriter_SendAction signature (required playerId; handle + params) ([7d7b326](https://github.com/ludeo-labs/core-integration-skill/commit/7d7b32618740519097a4b5a7c6d6d8eccac50aa5))
* **restoration:** pause at LudeoSelected, apply AFTER unpause-in-OnRoomReady, then Begin (CR-010) ([d6efb80](https://github.com/ludeo-labs/core-integration-skill/commit/d6efb80608946e7d02d8c2f4e10318951ee2ba52))
* **restoration:** pre-match skips MUST happen before pause (clean post-skip baseline = smoother handoff) ([5580450](https://github.com/ludeo-labs/core-integration-skill/commit/55804500de12b5e1cf43fcece40d7850944a15c7))


### Features

* **game-patterns:** add racing genre playbook + INDEX entry ([8a230c3](https://github.com/ludeo-labs/core-integration-skill/commit/8a230c362b84db34fb0532b5eb66fc5605fc111c))
* **lifecycle:** push overlay-pause contract upstream to phase 3/4 + add CR-011 (mid-play overlay pause) ([033915b](https://github.com/ludeo-labs/core-integration-skill/commit/033915b5fef9258cd06e713d17e17fb2e32d62d6))
* **restoration:** /10 Step 12.5 — self-validate the plan before human review ([5280be8](https://github.com/ludeo-labs/core-integration-skill/commit/5280be869cfba4cb414453f14e49e705e69625b8))
* **restoration:** /11 Step 9 iteration discipline + escalation gates ([e626407](https://github.com/ludeo-labs/core-integration-skill/commit/e62640761553c1d8384363c95d79bd3367244975))
* **restoration:** add --ludeo=<id> launch-arg local-trigger affordance ([d6dbdaa](https://github.com/ludeo-labs/core-integration-skill/commit/d6dbdaae4c6d04d0c35e948ace0273b911799bb3))
* **restoration:** add /11 Step 9 — required local smoke test (run with --ludeo, verify load+pause, hand off to player) ([b800f83](https://github.com/ludeo-labs/core-integration-skill/commit/b800f83ca0a59d02eac03987ec16f6bd54e4a0ef))
* **restoration:** crash handling in /11 Step 9 + new 11-TROUBLESHOOTING §6 (7 crash buckets) ([966d57c](https://github.com/ludeo-labs/core-integration-skill/commit/966d57cf18c05fc5a7215ae22b914107ca56b253))
* **restoration:** land phases 10/11/07 + CR-010 overlay-pause + RoomReady-driven post-restore resume ([26c5c56](https://github.com/ludeo-labs/core-integration-skill/commit/26c5c562ed65652ee605bdcc5dcf3d5b79c8ac61))
* **restoration:** suppress pre-match cutscenes / default-spawn / location overrides; validate first frame = captured moment ([bcae4f2](https://github.com/ludeo-labs/core-integration-skill/commit/bcae4f202c0e8d0e0dbd299ee3099896de0430ec))
* **workflow:** expand SKILL.md to a 14-phase workflow; add save-system phase (2c) and TDD phase (2b) ([524c71a](https://github.com/ludeo-labs/core-integration-skill/commit/524c71a81f289b43d02151a6d7e4456d06002dca))

# 1.0.0 (2026-05-27)


### Features

* sync latest workflow content into skill; add TDD + object-tracking phases ([dca3340](https://github.com/ludeo-labs/core-integration-skill/commit/dca33403108c724b303cfdaf607a5ef58bc0f1c9))
