#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameMode.h"
#include "FGGameMode.generated.h"

class AFGSectorGenerator;
class AFGTacticalPreviewCamera;

/**
 * Server-authoritative game mode for a continuous, respawn-based tactical match:
 * generate the sectors, run a fixed-length tactical overhead preview, then let the
 * match run continuously with individual respawns (no round resets) until the
 * configured match duration/score limit ends it.
 */
UCLASS()
class FORGEGAMES_API AFGGameMode : public AGameMode
{
	GENERATED_BODY()

public:
	AFGGameMode();

	/** Server-only: called when a pawn is eliminated. Handles scoring, stats, and the respawn timer. */
	void HandlePlayerElimination(AController* VictimController, AController* KillerController);

protected:
	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual void PostLogin(APlayerController* NewPlayer) override;
	virtual void HandleMatchIsWaitingToStart() override;
	virtual bool ReadyToStartMatch_Implementation() override;
	virtual void HandleMatchHasStarted() override;

	/** How long the overhead tactical preview holds before the match goes live. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Match")
	float TacticalPreviewDuration = 4.f;

	/** Delay between an elimination and that player's respawn. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Match")
	float RespawnDelay = 3.f;

	/** Points awarded to the killer's team on an elimination. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Match")
	int32 PointsPerElimination = 1;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Match")
	int32 NumberOfTeams = 2;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	TSubclassOf<AFGSectorGenerator> SectorGeneratorClass;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Map")
	TSubclassOf<AFGTacticalPreviewCamera> TacticalPreviewCameraClass;

private:
	void BeginTacticalPreview();
	void EndTacticalPreview();
	void RespawnController(TWeakObjectPtr<AController> ControllerToRespawn);

	int32 AssignNextTeam();

	UPROPERTY()
	TObjectPtr<AFGSectorGenerator> SectorGenerator = nullptr;

	UPROPERTY()
	TObjectPtr<AFGTacticalPreviewCamera> TacticalPreviewCamera = nullptr;

	FTimerHandle TacticalPreviewTimerHandle;

	bool bTacticalPreviewComplete = false;
	int32 NextTeamAssignment = 0;
};
