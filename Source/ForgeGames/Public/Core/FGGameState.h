#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "FGGameState.generated.h"

/** Continuous match phases. The tactical preview sits between waiting-to-start and the live round. */
UENUM(BlueprintType)
enum class EFGMatchPhase : uint8
{
	WaitingForPlayers,
	TacticalPreview,
	InProgress,
	MatchComplete
};

USTRUCT(BlueprintType)
struct FFGTeamScore
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	int32 TeamId = INDEX_NONE;

	UPROPERTY(BlueprintReadOnly)
	int32 Score = 0;
};

/**
 * Replicated match state shared with every client. All mutation happens on the server
 * (via AFGGameMode); clients only ever read these properties.
 */
UCLASS()
class FORGEGAMES_API AFGGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	AFGGameState();

	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Scoring")
	int32 GetTeamScore(int32 TeamId) const;

	/** Server-only: adds points to a team's authoritative score. */
	void AddTeamScore(int32 TeamId, int32 Points);

	/** Server-only: registers a team so it shows up in the scoreboard even at zero score. */
	void RegisterTeam(int32 TeamId);

	UPROPERTY(ReplicatedUsing = OnRep_MatchPhase, BlueprintReadOnly, Category = "ForgeGames|Match")
	EFGMatchPhase MatchPhase = EFGMatchPhase::WaitingForPlayers;

	/** Server time (seconds) the tactical preview will end, used by clients to drive the countdown UI. */
	UPROPERTY(Replicated, BlueprintReadOnly, Category = "ForgeGames|Match")
	float TacticalPreviewEndServerTime = 0.f;

	UFUNCTION(BlueprintImplementableEvent, Category = "ForgeGames|Match")
	void OnMatchPhaseChanged(EFGMatchPhase NewPhase);

	void SetMatchPhase(EFGMatchPhase NewPhase);

protected:
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UPROPERTY(ReplicatedUsing = OnRep_TeamScores, BlueprintReadOnly, Category = "ForgeGames|Scoring")
	TArray<FFGTeamScore> TeamScores;

	UFUNCTION()
	void OnRep_TeamScores();

	UFUNCTION()
	void OnRep_MatchPhase();
};
