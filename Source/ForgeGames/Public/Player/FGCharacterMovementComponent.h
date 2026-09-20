#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "FGCharacterMovementComponent.generated.h"

UENUM(BlueprintType)
enum class EFGCustomMovementMode : uint8
{
	None,
	Slide
};

/**
 * Adds network-predicted sprint and slide on top of the stock character movement.
 * Sprint/slide intent travels to the server as compressed move flags (see
 * FSavedMove_FGCharacter in the .cpp) so both are fully client-predicted and
 * server-authoritative like the rest of character movement.
 */
UCLASS()
class FORGEGAMES_API UFGCharacterMovementComponent : public UCharacterMovementComponent
{
	GENERATED_BODY()

public:
	UFGCharacterMovementComponent();

	virtual float GetMaxSpeed() const override;
	virtual void UpdateFromCompressedFlags(uint8 Flags) override;
	virtual FNetworkPredictionData_Client* GetPredictionData_Client() const override;

	void SetWantsToSprint(bool bNewSprint);
	bool WantsToSprint() const { return bWantsToSprint; }

	void SetWantsToSlide(bool bNewSlide);
	bool WantsToSlide() const { return bWantsToSlide; }

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Movement")
	float SprintSpeedMultiplier = 1.6f;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Movement")
	float SlideSpeedBoost = 1.3f;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Movement")
	float SlideDuration = 0.8f;

	/** Fraction of max walk speed the character must be moving at to start a slide. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Movement")
	float SlideMinSpeedFraction = 0.5f;

protected:
	virtual void PhysCustom(float deltaTime, int32 Iterations) override;
	void PhysSlide(float deltaTime, int32 Iterations);

private:
	bool CanSlide() const;
	void EnterSlide();
	void ExitSlide();

	bool bWantsToSprint = false;
	bool bWantsToSlide = false;
	float SlideTimeRemaining = 0.f;
};
