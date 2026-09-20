#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "FGPlayerState.generated.h"

UCLASS()
class FORGEGAMES_API AFGPlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	AFGPlayerState();

	UPROPERTY(ReplicatedUsing = OnRep_TeamId, BlueprintReadOnly, Category = "ForgeGames|Team")
	int32 TeamId = INDEX_NONE;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "ForgeGames|Stats")
	int32 Kills = 0;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "ForgeGames|Stats")
	int32 Deaths = 0;

	/** Server-only. */
	void SetTeamId(int32 NewTeamId);

	/** Server-only. */
	void AddKill();

	/** Server-only. */
	void AddDeath();

protected:
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UFUNCTION()
	void OnRep_TeamId();
};
