# Forge Games — Debut Title

A high-intensity, server-authoritative tactical FPS built in Unreal Engine 5 (C++). Continuous
respawn-based matches on procedurally laid out land maps, with a Fortnite-style vibrant, stylized
art direction as the visual target.

## Requirements

- Unreal Engine 5.4 (see `EngineAssociation` in `ForgeGames.uproject`)
- Visual Studio 2022 (Windows) or Xcode (Mac) with UE5 C++ workflow support

## Project Structure

```
ForgeGames.uproject
Source/
├── ForgeGames.Target.cs / ForgeGamesEditor.Target.cs
└── ForgeGames/
    ├── ForgeGames.Build.cs / ForgeGames.h / ForgeGames.cpp   (module entry point)
    ├── Public/  Private/
    │   ├── Core/     — AFGGameMode, AFGGameState, AFGPlayerState, AFGPlayerController
    │   ├── Player/   — AFGCharacter, UFGCharacterMovementComponent (sprint + slide)
    │   ├── Weapons/  — AFGWeaponBase, UFGInventoryComponent
    │   ├── Map/      — AFGSectorGenerator (procedural sector layout)
    │   └── Camera/   — AFGTacticalPreviewCamera
Config/
├── DefaultEngine.ini
├── DefaultGame.ini
└── DefaultInput.ini
```

## What's implemented in this skeleton

- **Match flow** (`AFGGameMode`/`AFGGameState`): server spawns the sector generator and tactical
  preview camera, holds a 4-second overhead preview (`TacticalPreviewDuration`) before the match
  goes live, then runs continuously — eliminations trigger a respawn timer (`RespawnDelay`)
  instead of a round reset. Team scores live on `AFGGameState` and are only ever mutated on the
  server.
- **Movement** (`UFGCharacterMovementComponent`): sprint and slide are implemented as
  network-predicted, server-authoritative character movement, using the standard UE
  `FSavedMove_Character` compressed-flags pattern so both replay/reconcile correctly under
  latency. Slide is a genuine custom movement mode (`PhysCustom`/`PhysSlide`), not a cosmetic
  animation layer.
- **Inventory** (`UFGInventoryComponent`/`AFGWeaponBase`): a dynamically sized weapon loadout
  (`MaxWeaponSlots`) with equip/cycle/drop, and weapons that fire via a server RPC so hit
  registration is authoritative.
- **Procedural map** (`AFGSectorGenerator`): divides the map into a grid of sectors, assigns each
  a weighted-random type (`FFGSectorTypeEntry`), and spawns that sector's content actor. Seeded
  via `RandomSeed` so a layout can be reproduced for testing.

## What still needs editor/content work

None of this compiles into a playable level by itself — it's the C++ foundation. To get a running
match you still need to, in the Unreal Editor:

1. Create Blueprint subclasses of `AFGGameMode`, `AFGCharacter`, `AFGWeaponBase`, etc. and assign
   meshes/animations/VFX (this is a code skeleton with no art).
2. Create Enhanced Input `InputAction`/`InputMappingContext` assets and assign them on the
   `AFGCharacter` Blueprint's `DefaultMappingContext`/`MoveAction`/`LookAction`/`SprintAction`/
   `SlideAction`/`JumpAction` properties — these are editor assets, not something C++/`.ini` can
   create directly.
3. Author `AFGSectorGenerator` Blueprint content actors (per `EFGSectorType`) and assign them to
   `SectorTypeEntries` on a `AFGSectorGenerator` Blueprint subclass.
4. Set the level's `GameMode Override` (or rely on `DefaultEngine.ini`'s `GlobalDefaultGameMode`)
   to your `AFGGameMode` Blueprint subclass, and assign `SectorGeneratorClass` /
   `TacticalPreviewCameraClass`.
5. Configure dedicated server / listen server packaging once gameplay is validated in PIE.
