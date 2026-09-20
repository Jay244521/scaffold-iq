#include "Core/FGGameMode.h"
#include "Core/FGGameState.h"
#include "Core/FGPlayerState.h"
#include "Core/FGPlayerController.h"
#include "Map/FGSectorGenerator.h"
#include "Camera/FGTacticalPreviewCamera.h"

AFGGameMode::AFGGameMode()
{
	GameStateClass = AFGGameState::StaticClass();
	PlayerStateClass = AFGPlayerState::StaticClass();
	PlayerControllerClass = AFGPlayerController::StaticClass();
}

void AFGGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);

	if (SectorGeneratorClass)
	{
		FActorSpawnParameters SpawnParams;
		SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		SectorGenerator = GetWorld()->SpawnActor<AFGSectorGenerator>(SectorGeneratorClass, FTransform::Identity, SpawnParams);
		if (SectorGenerator)
		{
			SectorGenerator->GenerateMap();
		}
	}

	if (TacticalPreviewCameraClass)
	{
		TacticalPreviewCamera = GetWorld()->SpawnActor<AFGTacticalPreviewCamera>(TacticalPreviewCameraClass);
		if (TacticalPreviewCamera && SectorGenerator)
		{
			TacticalPreviewCamera->FrameSectorGrid(SectorGenerator->GetSectorDefinitions());
		}
	}

	if (AFGGameState* FGGameState = GetGameState<AFGGameState>())
	{
		for (int32 TeamId = 0; TeamId < NumberOfTeams; ++TeamId)
		{
			FGGameState->RegisterTeam(TeamId);
		}
	}
}

void AFGGameMode::PostLogin(APlayerController* NewPlayer)
{
	Super::PostLogin(NewPlayer);

	if (AFGPlayerState* FGPlayerState = NewPlayer ? NewPlayer->GetPlayerState<AFGPlayerState>() : nullptr)
	{
		FGPlayerState->SetTeamId(AssignNextTeam());
	}
}

int32 AFGGameMode::AssignNextTeam()
{
	const int32 Assigned = NextTeamAssignment;
	NextTeamAssignment = (NextTeamAssignment + 1) % FMath::Max(1, NumberOfTeams);
	return Assigned;
}

void AFGGameMode::HandleMatchIsWaitingToStart()
{
	Super::HandleMatchIsWaitingToStart();
	BeginTacticalPreview();
}

void AFGGameMode::BeginTacticalPreview()
{
	bTacticalPreviewComplete = false;

	if (AFGGameState* FGGameState = GetGameState<AFGGameState>())
	{
		FGGameState->SetMatchPhase(EFGMatchPhase::TacticalPreview);
		FGGameState->TacticalPreviewEndServerTime = GetWorld()->GetTimeSeconds() + TacticalPreviewDuration;
	}

	if (TacticalPreviewCamera)
	{
		for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
		{
			if (AFGPlayerController* FGPC = Cast<AFGPlayerController>(It->Get()))
			{
				FGPC->Client_ShowTacticalPreview(TacticalPreviewCamera, TacticalPreviewDuration);
			}
		}
	}

	GetWorldTimerManager().SetTimer(TacticalPreviewTimerHandle, this, &AFGGameMode::EndTacticalPreview, TacticalPreviewDuration, false);
}

void AFGGameMode::EndTacticalPreview()
{
	bTacticalPreviewComplete = true;
}

bool AFGGameMode::ReadyToStartMatch_Implementation()
{
	return bTacticalPreviewComplete && Super::ReadyToStartMatch_Implementation();
}

void AFGGameMode::HandleMatchHasStarted()
{
	Super::HandleMatchHasStarted();

	if (AFGGameState* FGGameState = GetGameState<AFGGameState>())
	{
		FGGameState->SetMatchPhase(EFGMatchPhase::InProgress);
	}
}

void AFGGameMode::HandlePlayerElimination(AController* VictimController, AController* KillerController)
{
	if (!HasAuthority() || !VictimController)
	{
		return;
	}

	AFGGameState* FGGameState = GetGameState<AFGGameState>();

	if (AFGPlayerState* VictimState = VictimController->GetPlayerState<AFGPlayerState>())
	{
		VictimState->AddDeath();
	}

	if (KillerController && KillerController != VictimController)
	{
		if (AFGPlayerState* KillerState = KillerController->GetPlayerState<AFGPlayerState>())
		{
			KillerState->AddKill();

			if (FGGameState)
			{
				FGGameState->AddTeamScore(KillerState->TeamId, PointsPerElimination);
			}
		}
	}

	FTimerHandle RespawnHandle;
	TWeakObjectPtr<AController> WeakVictim(VictimController);
	FTimerDelegate RespawnDelegate = FTimerDelegate::CreateUObject(this, &AFGGameMode::RespawnController, WeakVictim);
	GetWorldTimerManager().SetTimer(RespawnHandle, RespawnDelegate, RespawnDelay, false);
}

void AFGGameMode::RespawnController(TWeakObjectPtr<AController> ControllerToRespawn)
{
	if (AController* Controller = ControllerToRespawn.Get())
	{
		RestartPlayer(Controller);
	}
}
